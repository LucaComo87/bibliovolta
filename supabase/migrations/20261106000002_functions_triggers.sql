-- =====================================================================
-- BIBLIOVOLTA · Migrazione 2 · Funzioni di sicurezza e trigger
-- =====================================================================
-- Tutte le funzioni SECURITY DEFINER fissano search_path = '' e usano
-- nomi completamente qualificati, come raccomandato da Supabase.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Ruoli dell'utente corrente
-- ---------------------------------------------------------------------
create or replace function public.is_teacher()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.teachers t
    where t.id = (select auth.uid()) and t.is_active
  );
$$;

create or replace function public.is_admin_teacher()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.teachers t
    where t.id = (select auth.uid()) and t.is_active and t.is_admin
  );
$$;

create or replace function public.is_student()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.students s
    where s.id = (select auth.uid()) and s.is_active
  );
$$;

create or replace function public.current_app_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$
  select case
    when public.is_teacher() then 'teacher'::public.user_role
    when public.is_student() then 'student'::public.user_role
    else null
  end;
$$;

-- ---------------------------------------------------------------------
-- Creazione automatica del profilo al primo accesso
--  * docenti: solo se l'account è stato creato con
--    app_metadata.bibliovolta_role = 'teacher' (impostabile SOLO con la
--    service role key, mai dal browser);
--  * studenti: solo email del dominio studenti configurato E accesso
--    tramite Google (una registrazione email+password con un indirizzo
--    studente viene rifiutata);
--  * qualunque altro account viene rifiutato (registrazione bloccata).
-- ---------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_email   text := lower(coalesce(new.email, ''));
  v_domain  text;
  v_meta    jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name    text;
begin
  select s.student_email_domain into v_domain from public.app_settings s where s.id = 1;
  v_name := coalesce(nullif(v_meta->>'full_name', ''), nullif(v_meta->>'name', ''), '');

  if coalesce(new.raw_app_meta_data->>'bibliovolta_role', '') = 'teacher' then
    insert into public.teachers (id, email, full_name, is_admin)
    values (
      new.id, v_email, v_name,
      coalesce((new.raw_app_meta_data->>'bibliovolta_admin')::boolean, false)
    );
  elsif v_email like '%@' || v_domain
        and coalesce(new.raw_app_meta_data->>'provider', '') = 'google' then
    insert into public.students (id, email, full_name, first_name, last_name)
    values (
      new.id, v_email, v_name,
      nullif(v_meta->>'given_name', ''),
      nullif(v_meta->>'family_name', '')
    );
  else
    raise exception 'BIBLIOVOLTA: account non autorizzato (%). Usa l''account istituzionale @%.', v_email, v_domain
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------
-- updated_at automatico
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.students            for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.teachers            for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.school_days         for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.bookings            for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.waitlist_entries    for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.seat_offers         for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.announcements       for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.app_settings        for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Giornate: devono stare dentro la stagione configurata e non possono
-- scendere sotto il numero di posti già prenotati.
-- ---------------------------------------------------------------------
create or replace function public.enforce_school_day_rules()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_settings public.app_settings;
  v_booked   integer;
begin
  select * into v_settings from public.app_settings where id = 1;

  if new.day < v_settings.season_start or new.day > v_settings.season_end then
    raise exception 'BIBLIOVOLTA: il % è fuori dalla stagione (% – %).',
      new.day, v_settings.season_start, v_settings.season_end
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and new.capacity < old.capacity then
    select count(*) into v_booked
      from public.bookings b
     where b.school_day_id = new.id and b.status = 'confirmed';
    if new.capacity < v_booked then
      raise exception 'BIBLIOVOLTA: capienza % inferiore ai % posti già prenotati.', new.capacity, v_booked
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger enforce_school_day_rules
  before insert or update on public.school_days
  for each row execute function public.enforce_school_day_rules();

-- ---------------------------------------------------------------------
-- Prenotazioni: controllo atomico della capienza.
-- La riga della giornata viene bloccata (FOR UPDATE), quindi due
-- prenotazioni contemporanee non possono superare il limite di 50.
-- ---------------------------------------------------------------------
create or replace function public.enforce_booking_capacity()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_day     public.school_days;
  v_booked  integer;
begin
  if new.status <> 'confirmed' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'confirmed' and old.school_day_id = new.school_day_id then
    return new; -- nessun nuovo posto occupato
  end if;

  select * into v_day from public.school_days where id = new.school_day_id for update;

  if not found then
    raise exception 'BIBLIOVOLTA: giornata inesistente.' using errcode = '23503';
  end if;
  if not v_day.is_open then
    raise exception 'BIBLIOVOLTA: l''aula studio è chiusa il %.', v_day.day using errcode = '23514';
  end if;

  if not exists (select 1 from public.students s where s.id = new.student_id and s.is_active) then
    raise exception 'BIBLIOVOLTA: studente non attivo.' using errcode = '23514';
  end if;

  select count(*) into v_booked
    from public.bookings b
   where b.school_day_id = new.school_day_id
     and b.status = 'confirmed'
     and b.id <> new.id;

  if v_booked >= v_day.capacity then
    raise exception 'BIBLIOVOLTA: posti esauriti per il % (capienza %).', v_day.day, v_day.capacity
      using errcode = 'P0001', hint = 'capacity_reached';
  end if;

  return new;
end;
$$;

create trigger enforce_booking_capacity
  before insert or update of status, school_day_id on public.bookings
  for each row execute function public.enforce_booking_capacity();

-- ---------------------------------------------------------------------
-- Registro delle operazioni (trigger generico)
-- ---------------------------------------------------------------------
create or replace function public.audit_row_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_old  jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_new  jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  v_diff jsonb := '{}'::jsonb;
  v_key  text;
begin
  if tg_op = 'UPDATE' then
    for v_key in select jsonb_object_keys(v_new) loop
      if v_key <> 'updated_at' and (v_new -> v_key) is distinct from (v_old -> v_key) then
        v_diff := v_diff || jsonb_build_object(v_key, jsonb_build_object('da', v_old -> v_key, 'a', v_new -> v_key));
      end if;
    end loop;
    if v_diff = '{}'::jsonb then
      return new; -- nessuna modifica reale
    end if;
  end if;

  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, details)
  values (
    (select auth.uid()),
    public.current_app_role(),
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    coalesce(v_new ->> 'id', v_old ->> 'id'),
    case tg_op
      when 'INSERT' then jsonb_build_object('nuovo', v_new)
      when 'UPDATE' then jsonb_build_object('modifiche', v_diff)
      else jsonb_build_object('eliminato', v_old)
    end
  );

  return coalesce(new, old);
end;
$$;

create trigger audit after insert or update or delete on public.bookings         for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.school_days      for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.waitlist_entries for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.seat_offers      for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.announcements    for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.teachers         for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.students         for each row execute function public.audit_row_change();
create trigger audit after update on public.app_settings                         for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------
-- Disponibilità pubblica dei posti (senza esporre chi ha prenotato)
-- ---------------------------------------------------------------------
create or replace function public.get_day_availability(p_from date, p_to date)
returns table (
  school_day_id   uuid,
  day             date,
  is_open         boolean,
  capacity        integer,
  booked          integer,
  available       integer,
  opens_at        time,
  closes_at       time,
  closure_reason  text,
  note            text
)
language sql stable security definer set search_path = ''
as $$
  select d.id, d.day, d.is_open, d.capacity,
         coalesce(b.n, 0)::integer as booked,
         case when d.is_open then greatest(d.capacity - coalesce(b.n, 0), 0) else 0 end::integer as available,
         d.opens_at, d.closes_at, d.closure_reason, d.note
    from public.school_days d
    left join (
      select school_day_id, count(*) as n
        from public.bookings
       where status = 'confirmed'
       group by school_day_id
    ) b on b.school_day_id = d.id
   where d.day between p_from and p_to
   order by d.day;
$$;
comment on function public.get_day_availability(date, date) is 'Posti liberi per giornata: restituisce solo conteggi, mai dati personali.';
