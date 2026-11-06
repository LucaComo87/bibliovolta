-- =====================================================================
-- BIBLIOVOLTA · Migrazione 5 · Autenticazione e registrazione (Fase 3)
-- =====================================================================
--  * studenti: accesso SOLO con Google, email del dominio scolastico
--    verificata da Google; registrazione iniziale (nome, cognome, classe)
--    tramite una funzione che modifica solo la riga dello studente stesso;
--  * docenti: account creati solo da email pre-autorizzate (teacher_invitations)
--    e obbligo di cambiare la password iniziale al primo accesso;
--  * protezione dai tentativi di accesso ripetuti (per email e per IP).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Studenti: stato della registrazione e formato della classe
-- ---------------------------------------------------------------------
alter table public.students
  add column registered_at timestamptz,
  add constraint students_class_format_ck
    check (class_name is null or class_name ~ '^[1-5][A-Z]{1,3}$'),
  add constraint students_names_len_ck
    check (coalesce(length(first_name), 0) <= 60 and coalesce(length(last_name), 0) <= 60);

comment on column public.students.registered_at is
  'Data di completamento della registrazione iniziale (nome, cognome, classe). Null = da completare.';

-- ---------------------------------------------------------------------
-- Docenti: cambio obbligatorio della password iniziale
-- ---------------------------------------------------------------------
alter table public.teachers
  add column must_change_password boolean not null default true,
  add column password_changed_at timestamptz;

-- ---------------------------------------------------------------------
-- Creazione profili: lo studente deve arrivare da Google con email
-- verificata. Sostituisce la versione della migrazione 2.
-- ---------------------------------------------------------------------
create or replace function public.is_allowed_student_email(p_email text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  -- una sola @, parte locale non vuota, dominio esattamente quello configurato
  select coalesce(p_email, '') ~ '^[^@\s]+@[^@\s]+$'
     and lower(split_part(p_email, '@', 2)) = (select s.student_email_domain from public.app_settings s where s.id = 1);
$$;

-- Docenti pre-autorizzati: lo script amministrativo (service role) inserisce
-- qui l'email PRIMA di creare l'account. Supabase Auth scrive app_metadata
-- solo dopo l'inserimento dell'utente, quindi il ruolo non può dipendere da lì.
create table public.teacher_invitations (
  email       text primary key check (email = lower(email)),
  full_name   text not null default '',
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.teacher_invitations enable row level security;
comment on table public.teacher_invitations is 'Email autorizzate a diventare account docente. Solo service role.';

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_email    text := lower(coalesce(new.email, ''));
  v_meta     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_provider text := coalesce(new.raw_app_meta_data->>'provider', '');
  v_name     text := coalesce(nullif(v_meta->>'full_name', ''), nullif(v_meta->>'name', ''), '');
  v_verified boolean := coalesce((v_meta->>'email_verified')::boolean, false);
  v_invite   public.teacher_invitations;
begin
  -- Account con email e password: SOLO docenti pre-autorizzati
  if v_provider <> 'google' then
    select * into v_invite from public.teacher_invitations where email = v_email;
    if not found then
      raise exception 'BIBLIOVOLTA: account non autorizzato.'
        using errcode = '42501', hint = 'not_invited';
    end if;
    insert into public.teachers (id, email, full_name, is_admin)
    values (new.id, v_email, coalesce(nullif(v_name, ''), v_invite.full_name), v_invite.is_admin);
    delete from public.teacher_invitations where email = v_email;
    return new;
  end if;

  -- Account Google: SOLO studenti del dominio scolastico con email verificata
  if not public.is_allowed_student_email(v_email) then
    raise exception 'BIBLIOVOLTA: account non autorizzato. Usa l''account istituzionale della scuola.'
      using errcode = '42501', hint = 'domain_not_allowed';
  end if;
  if not v_verified then
    raise exception 'BIBLIOVOLTA: email non verificata da Google.'
      using errcode = '42501', hint = 'email_not_verified';
  end if;

  insert into public.students (id, email, full_name, first_name, last_name)
  values (
    new.id, v_email, v_name,
    -- Supabase Auth mette given_name/family_name di Google in custom_claims
    left(nullif(trim(coalesce(v_meta->>'given_name', v_meta->'custom_claims'->>'given_name')), ''), 60),
    left(nullif(trim(coalesce(v_meta->>'family_name', v_meta->'custom_claims'->>'family_name')), ''), 60)
  );
  return new;
end;
$$;

-- L'email di uno studente non può essere cambiata verso un altro dominio.
create or replace function public.guard_auth_user_email_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.email is distinct from old.email
     and exists (select 1 from public.students s where s.id = new.id)
     and not public.is_allowed_student_email(new.email) then
    raise exception 'BIBLIOVOLTA: l''email di uno studente deve restare nel dominio scolastico.'
      using errcode = '42501';
  end if;
  if new.email is distinct from old.email then
    update public.students set email = lower(new.email) where id = new.id;
    update public.teachers set email = lower(new.email) where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_change
  before update of email on auth.users
  for each row execute function public.guard_auth_user_email_change();

-- ---------------------------------------------------------------------
-- Registrazione iniziale dello studente (solo la propria riga, una volta)
-- ---------------------------------------------------------------------
create or replace function public.complete_student_registration(
  p_first_name text,
  p_last_name  text,
  p_class_name text
)
returns public.students
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_first text := regexp_replace(trim(coalesce(p_first_name, '')), '\s+', ' ', 'g');
  v_last  text := regexp_replace(trim(coalesce(p_last_name, '')), '\s+', ' ', 'g');
  v_class text := upper(regexp_replace(coalesce(p_class_name, ''), '\s', '', 'g'));
  -- lettere latine, anche accentate (indipendente dalla collation del database)
  v_name_re constant text := '^[A-Za-zÀ-ÖØ-öø-ÿĀ-ž]+([ ''’.-][A-Za-zÀ-ÖØ-öø-ÿĀ-ž]+)*\.?$';
  v_row   public.students;
begin
  if v_uid is null then
    raise exception 'BIBLIOVOLTA: accesso richiesto.' using errcode = '42501';
  end if;

  select * into v_row from public.students where id = v_uid and is_active for update;
  if not found then
    raise exception 'BIBLIOVOLTA: profilo studente non trovato.' using errcode = '42501';
  end if;
  if v_row.registered_at is not null then
    raise exception 'BIBLIOVOLTA: registrazione già completata.' using errcode = 'P0001', hint = 'already_registered';
  end if;

  if length(v_first) not between 1 and 60 or v_first !~ v_name_re then
    raise exception 'BIBLIOVOLTA: nome non valido.' using errcode = '22023', hint = 'first_name';
  end if;
  if length(v_last) not between 1 and 60 or v_last !~ v_name_re then
    raise exception 'BIBLIOVOLTA: cognome non valido.' using errcode = '22023', hint = 'last_name';
  end if;
  if v_class !~ '^[1-5][A-Z]{1,3}$' then
    raise exception 'BIBLIOVOLTA: classe non valida (es. 4B).' using errcode = '22023', hint = 'class_name';
  end if;

  update public.students
     set first_name = v_first,
         last_name = v_last,
         full_name = v_first || ' ' || v_last,
         class_name = v_class,
         registered_at = now()
   where id = v_uid
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- Password docenti: segnata come cambiata SOLO dal server (service role),
-- dopo che Supabase Auth ha davvero aggiornato la password.
-- ---------------------------------------------------------------------
create or replace function public.mark_teacher_password_changed(p_teacher_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.teachers
     set must_change_password = false, password_changed_at = now()
   where id = p_teacher_id;
$$;

create or replace function public.require_teacher_password_change(p_teacher_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.teachers set must_change_password = true where id = p_teacher_id;
$$;

-- ---------------------------------------------------------------------
-- Protezione dagli accessi ripetuti
--   * per email: 5 errori in 15 minuti → blocco per 15 minuti
--   * per IP:   20 errori in 15 minuti → blocco per 15 minuti
-- Un accesso riuscito azzera il conteggio per quell'email.
-- ---------------------------------------------------------------------
create table public.auth_attempts (
  id          bigint generated always as identity primary key,
  kind        text not null check (kind in ('teacher_login', 'password_change')),
  email       text not null check (email = lower(email)),
  ip          text not null default 'unknown',
  succeeded   boolean not null,
  created_at  timestamptz not null default now()
);
create index auth_attempts_email_idx on public.auth_attempts (email, created_at desc);
create index auth_attempts_ip_idx on public.auth_attempts (ip, created_at desc);
alter table public.auth_attempts enable row level security;
comment on table public.auth_attempts is 'Tentativi di accesso dei docenti. Nessuna policy: accessibile solo al service role.';

create or replace function public.auth_lockout_seconds(p_email text, p_ip text)
returns integer
language plpgsql stable security definer set search_path = ''
as $$
declare
  c_window  constant interval := interval '15 minutes';
  c_email_max constant integer := 5;
  c_ip_max    constant integer := 20;
  v_email   text := lower(trim(coalesce(p_email, '')));
  v_since   timestamptz;
  v_until   timestamptz := null;
  v_t       timestamptz;
begin
  -- errori per email dopo l'ultimo accesso riuscito, nella finestra
  select greatest(now() - c_window, coalesce(max(created_at), '-infinity'::timestamptz))
    into v_since
    from public.auth_attempts
   where email = v_email and succeeded;

  select created_at into v_t
    from public.auth_attempts
   where email = v_email and not succeeded and created_at > v_since
   order by created_at desc
   offset c_email_max - 1 limit 1;
  if v_t is not null then
    v_until := v_t + c_window;
  end if;

  select created_at into v_t
    from public.auth_attempts
   where ip = coalesce(p_ip, 'unknown') and not succeeded and created_at > now() - c_window
   order by created_at desc
   offset c_ip_max - 1 limit 1;
  if v_t is not null and (v_until is null or v_t + c_window > v_until) then
    v_until := v_t + c_window;
  end if;

  if v_until is null or v_until <= now() then
    return 0;
  end if;
  return ceil(extract(epoch from (v_until - now())))::integer;
end;
$$;

create or replace function public.record_auth_attempt(p_kind text, p_email text, p_ip text, p_succeeded boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.auth_attempts (kind, email, ip, succeeded)
  values (p_kind, lower(trim(coalesce(p_email, ''))), coalesce(nullif(p_ip, ''), 'unknown'), p_succeeded);
  -- pulizia: si conservano 30 giorni
  delete from public.auth_attempts where created_at < now() - interval '30 days';
end;
$$;

-- ---------------------------------------------------------------------
-- Privilegi: Supabase concede di default tutto ad anon/authenticated
-- sugli oggetti nuovi, quindi li togliamo esplicitamente.
-- ---------------------------------------------------------------------
revoke all on public.auth_attempts from public, anon, authenticated;
revoke all on public.teacher_invitations from public, anon, authenticated;
revoke all on sequence public.auth_attempts_id_seq from public, anon, authenticated;

revoke execute on function public.is_allowed_student_email(text) from public, anon;
grant execute on function public.is_allowed_student_email(text) to authenticated;

revoke execute on function public.complete_student_registration(text, text, text) from public, anon;
grant execute on function public.complete_student_registration(text, text, text) to authenticated;

revoke execute on function
  public.mark_teacher_password_changed(uuid),
  public.require_teacher_password_change(uuid),
  public.auth_lockout_seconds(text, text),
  public.record_auth_attempt(text, text, text, boolean),
  public.guard_auth_user_email_change(),
  public.handle_new_auth_user()
  from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function
      public.mark_teacher_password_changed(uuid),
      public.require_teacher_password_change(uuid),
      public.auth_lockout_seconds(text, text),
      public.record_auth_attempt(text, text, text, boolean)
      to service_role;
    grant select, insert, delete on public.auth_attempts to service_role;
    grant select, insert, update, delete on public.teacher_invitations to service_role;
  end if;
end;
$$;
