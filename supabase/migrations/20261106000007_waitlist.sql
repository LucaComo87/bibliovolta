-- =====================================================================
-- BIBLIOVOLTA · Migrazione 7 · Lista d'attesa automatica (Fase 5)
-- =====================================================================
--  * iscrizione in ordine cronologico rigoroso (numero progressivo);
--  * quando si libera un posto: proposta personale al primo in lista,
--    link con token casuale (salvato solo come hash SHA-256), scadenza
--    configurabile dai docenti (predefinita 2 ore), uso singolo;
--  * il posto proposto è "trattenuto": nessun altro può prenotarlo
--    finché la proposta è aperta → mai più di 50 prenotazioni;
--  * nessuna nuova proposta dopo la scadenza delle 24 ore prima
--    dell'apertura; le proposte già inviate restano valide fino alla
--    loro scadenza;
--  * chiusura di una giornata: proposte annullate, avvisi agli studenti;
--  * coda delle email (notification_outbox) inviata dal server con Resend;
--  * manutenzione automatica ogni minuto con Supabase Cron (pg_cron).
-- Ordine dei blocchi per evitare stalli: sempre prima la GIORNATA
-- (school_days FOR UPDATE), poi la proposta o l'iscrizione.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Nuove colonne
-- ---------------------------------------------------------------------
alter table public.app_settings
  add column offer_minutes integer not null default 120 check (offer_minutes between 15 and 720);
comment on column public.app_settings.offer_minutes is 'Tempo concesso per confermare un posto proposto dalla lista d''attesa (minuti).';

alter table public.school_days
  add column waitlist_paused boolean not null default false;
comment on column public.school_days.waitlist_paused is 'Lista d''attesa sospesa dai docenti: nessuna nuova iscrizione né proposta.';

alter table public.waitlist_entries
  add column queue_seq bigint generated always as identity,
  add column end_reason text;
create unique index waitlist_queue_seq_idx on public.waitlist_entries (queue_seq);
drop index if exists public.waitlist_queue_idx;
create index waitlist_queue_idx on public.waitlist_entries (school_day_id, queue_seq) where status = 'waiting';

alter table public.seat_offers
  add column token_hash text unique,
  add column used_at timestamptz,
  add column end_reason text;

-- ---------------------------------------------------------------------
-- Coda delle notifiche email (solo server)
-- ---------------------------------------------------------------------
create table public.notification_outbox (
  id           bigint generated always as identity primary key,
  kind         text not null check (kind in (
                 'waitlist_offer', 'offer_confirmed', 'offer_expired',
                 'day_closed_booked', 'day_closed_waitlist')),
  student_id   uuid references public.students (id) on delete cascade,
  to_email     text not null,
  payload      jsonb not null default '{}'::jsonb,   -- il token in chiaro resta qui solo fino all'invio
  status       text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts     integer not null default 0,
  last_error   text,
  provider_id  text,
  created_at   timestamptz not null default now(),
  claimed_at   timestamptz,
  sent_at      timestamptz
);
create index notification_outbox_pending_idx on public.notification_outbox (id) where status in ('pending', 'sending');
alter table public.notification_outbox enable row level security;
comment on table public.notification_outbox is 'Email da inviare. Nessuna policy: accessibile solo al service role.';

create or replace function public.enqueue_notification(p_kind text, p_student_id uuid, p_payload jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.notification_outbox (kind, student_id, to_email, payload)
  select p_kind, s.id, s.email,
         p_payload || jsonb_build_object('first_name', coalesce(s.first_name, ''), 'last_name', coalesce(s.last_name, ''))
    from public.students s
   where s.id = p_student_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Posti trattenuti dalle proposte aperte
-- ---------------------------------------------------------------------
create or replace function public.day_held_seats(p_school_day_id uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
  select count(*)::integer from public.seat_offers
   where school_day_id = p_school_day_id and status = 'pending';
$$;

create or replace function public.day_confirmed_seats(p_school_day_id uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
  select count(*)::integer from public.bookings
   where school_day_id = p_school_day_id and status = 'confirmed';
$$;

-- La capienza non può scendere sotto prenotazioni + posti proposti.
create or replace function public.enforce_school_day_rules()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_settings public.app_settings;
  v_taken    integer;
begin
  select * into v_settings from public.app_settings where id = 1;

  if new.day < v_settings.season_start or new.day > v_settings.season_end then
    raise exception 'BIBLIOVOLTA: il % è fuori dalla stagione (% – %).',
      new.day, v_settings.season_start, v_settings.season_end
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and new.capacity < old.capacity then
    v_taken := public.day_confirmed_seats(new.id) + public.day_held_seats(new.id);
    if new.capacity < v_taken then
      raise exception 'BIBLIOVOLTA: capienza % inferiore ai % posti già prenotati o proposti.', new.capacity, v_taken
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Cuore della lista d'attesa: assegna i posti liberi ai primi in coda.
-- Chiamata dopo ogni annullamento, scadenza, rinuncia, riapertura,
-- aumento di capienza e dalla manutenzione periodica.
-- ---------------------------------------------------------------------
create or replace function public.process_day_waitlist(p_school_day_id uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_day      public.school_days;
  v_minutes  integer;
  v_free     integer;
  v_entry    public.waitlist_entries;
  v_token    text;
  v_offer    public.seat_offers;
  v_count    integer := 0;
begin
  select * into v_day from public.school_days where id = p_school_day_id for update;
  if not found or not v_day.is_open or v_day.waitlist_paused then
    return 0;
  end if;
  -- regola delle 24 ore: dopo la scadenza nessuna nuova proposta
  if now() >= public.cancellation_deadline(v_day.day, v_day.opens_at) then
    return 0;
  end if;

  select s.offer_minutes into v_minutes from public.app_settings s where s.id = 1;
  v_free := v_day.capacity - public.day_confirmed_seats(v_day.id) - public.day_held_seats(v_day.id);

  while v_free > 0 loop
    select * into v_entry
      from public.waitlist_entries
     where school_day_id = v_day.id and status = 'waiting'
     order by queue_seq
     limit 1
     for update;
    exit when not found;

    -- token casuale (2 UUID v4 da generatore crittografico: 244 bit), conservato solo come hash
    v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

    insert into public.seat_offers (school_day_id, student_id, waitlist_entry_id, status, offered_at, expires_at, token_hash)
    values (v_day.id, v_entry.student_id, v_entry.id, 'pending', now(), now() + make_interval(mins => v_minutes),
            encode(sha256(convert_to(v_token, 'UTF8')), 'hex'))
    returning * into v_offer;

    update public.waitlist_entries set status = 'offered' where id = v_entry.id;

    perform public.enqueue_notification('waitlist_offer', v_entry.student_id, jsonb_build_object(
      'offer_id', v_offer.id, 'token', v_token, 'day', v_day.day,
      'opens_at', to_char(v_day.opens_at, 'HH24:MI'), 'closes_at', to_char(v_day.closes_at, 'HH24:MI'),
      'expires_at', v_offer.expires_at));

    v_free := v_free - 1;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- Prenotazione normale: ora conta anche i posti proposti
-- ---------------------------------------------------------------------
create or replace function public.book_seat(p_school_day_id uuid)
returns public.bookings
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_student public.students;
  v_day     public.school_days;
  v_taken   integer;
  v_row     public.bookings;
begin
  if v_uid is null then
    raise exception 'Accesso richiesto.' using errcode = '42501', hint = 'not_authenticated';
  end if;

  select * into v_student from public.students where id = v_uid and is_active;
  if not found then
    raise exception 'Solo gli studenti possono prenotare.' using errcode = '42501', hint = 'not_student';
  end if;
  if v_student.registered_at is null then
    raise exception 'Completa prima la registrazione.' using errcode = '42501', hint = 'not_registered';
  end if;

  select * into v_day from public.school_days where id = p_school_day_id for update;
  if not found then
    raise exception 'Giornata inesistente.' using errcode = 'P0002', hint = 'day_not_found';
  end if;
  if not v_day.is_open then
    raise exception 'L''aula studio è chiusa in questa giornata.' using errcode = 'P0001', hint = 'day_closed';
  end if;
  if now() >= public.day_opening_at(v_day.day, v_day.opens_at) then
    raise exception 'Le prenotazioni per questa giornata sono chiuse.' using errcode = 'P0001', hint = 'booking_closed';
  end if;

  if exists (select 1 from public.bookings where student_id = v_uid and school_day_id = v_day.id and status = 'confirmed') then
    raise exception 'Hai già una prenotazione per questa giornata.' using errcode = 'P0001', hint = 'already_booked';
  end if;
  if exists (select 1 from public.seat_offers where student_id = v_uid and school_day_id = v_day.id and status = 'pending') then
    raise exception 'Hai già un posto riservato per questa giornata: confermalo dalla proposta ricevuta.' using errcode = 'P0001', hint = 'offer_pending';
  end if;

  v_taken := public.day_confirmed_seats(v_day.id) + public.day_held_seats(v_day.id);
  if v_taken >= v_day.capacity then
    raise exception 'È stato raggiunto il numero massimo di % prenotazioni. Puoi iscriverti alla lista d''attesa.', v_day.capacity
      using errcode = 'P0001', hint = 'capacity_reached';
  end if;

  insert into public.bookings (student_id, school_day_id, status, source, created_by)
  values (v_uid, v_day.id, 'confirmed', 'student', v_uid)
  returning * into v_row;

  -- chi era in lista e trova un posto libero (es. dopo le 24 ore) esce dalla lista
  update public.waitlist_entries
     set status = 'assigned', end_reason = 'Prenotazione diretta'
   where student_id = v_uid and school_day_id = v_day.id and status = 'waiting';

  return v_row;
exception
  when unique_violation then
    raise exception 'Hai già una prenotazione per questa giornata.' using errcode = 'P0001', hint = 'already_booked';
end;
$$;

-- ---------------------------------------------------------------------
-- Annullamento di una prenotazione → il posto passa alla lista d'attesa
-- (trigger: vale anche per gli annullamenti fatti dai docenti)
-- ---------------------------------------------------------------------
create or replace function public.after_booking_cancelled()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.status = 'confirmed' and new.status = 'cancelled' then
    perform public.process_day_waitlist(new.school_day_id);
  end if;
  return new;
end;
$$;

create trigger after_booking_cancelled
  after update of status on public.bookings
  for each row execute function public.after_booking_cancelled();

-- ---------------------------------------------------------------------
-- Iscrizione alla lista d'attesa
-- ---------------------------------------------------------------------
create or replace function public.waitlist_position(p_entry_id uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
  select case when e.status = 'waiting' then (
           select count(*)::integer from public.waitlist_entries w
            where w.school_day_id = e.school_day_id and w.status = 'waiting' and w.queue_seq <= e.queue_seq)
         else null end
    from public.waitlist_entries e where e.id = p_entry_id;
$$;

create or replace function public.join_waitlist(p_school_day_id uuid)
returns table (entry_id uuid, joined_at timestamptz, queue_position integer)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_student public.students;
  v_day     public.school_days;
  v_entry   public.waitlist_entries;
begin
  if v_uid is null then
    raise exception 'Accesso richiesto.' using errcode = '42501', hint = 'not_authenticated';
  end if;
  select * into v_student from public.students where id = v_uid and is_active;
  if not found or v_student.registered_at is null then
    raise exception 'Solo gli studenti registrati possono iscriversi.' using errcode = '42501', hint = 'not_student';
  end if;

  select * into v_day from public.school_days where id = p_school_day_id for update;
  if not found then
    raise exception 'Giornata inesistente.' using errcode = 'P0002', hint = 'day_not_found';
  end if;
  if not v_day.is_open then
    raise exception 'L''aula studio è chiusa in questa giornata.' using errcode = 'P0001', hint = 'day_closed';
  end if;
  if v_day.waitlist_paused then
    raise exception 'La lista d''attesa di questa giornata è sospesa.' using errcode = 'P0001', hint = 'waitlist_paused';
  end if;
  if now() >= public.cancellation_deadline(v_day.day, v_day.opens_at) then
    raise exception 'La lista d''attesa è chiusa: mancano meno di % ore all''apertura.',
      (select s.cancellation_hours from public.app_settings s where s.id = 1)
      using errcode = 'P0001', hint = 'waitlist_closed';
  end if;
  if exists (select 1 from public.bookings where student_id = v_uid and school_day_id = v_day.id and status = 'confirmed') then
    raise exception 'Hai già una prenotazione per questa giornata.' using errcode = 'P0001', hint = 'already_booked';
  end if;
  if exists (select 1 from public.waitlist_entries where student_id = v_uid and school_day_id = v_day.id and status in ('waiting', 'offered')) then
    raise exception 'Sei già in lista d''attesa per questa giornata.' using errcode = 'P0001', hint = 'already_waiting';
  end if;
  if public.day_confirmed_seats(v_day.id) + public.day_held_seats(v_day.id) < v_day.capacity then
    raise exception 'Ci sono ancora posti liberi: puoi prenotare direttamente.' using errcode = 'P0001', hint = 'seats_available';
  end if;

  insert into public.waitlist_entries (student_id, school_day_id, status, joined_at)
  values (v_uid, v_day.id, 'waiting', clock_timestamp())
  returning * into v_entry;

  return query select v_entry.id, v_entry.joined_at, public.waitlist_position(v_entry.id);
exception
  when unique_violation then
    raise exception 'Sei già in lista d''attesa per questa giornata.' using errcode = 'P0001', hint = 'already_waiting';
end;
$$;

-- ---------------------------------------------------------------------
-- Uscita dalla lista (anche con una proposta aperta: il posto passa al successivo)
-- ---------------------------------------------------------------------
create or replace function public.leave_waitlist(p_entry_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_day_id uuid;
  v_entry  public.waitlist_entries;
begin
  select school_day_id into v_day_id from public.waitlist_entries where id = p_entry_id and student_id = v_uid;
  if v_day_id is null then
    raise exception 'Iscrizione non trovata.' using errcode = 'P0002', hint = 'entry_not_found';
  end if;
  perform 1 from public.school_days where id = v_day_id for update;
  select * into v_entry from public.waitlist_entries where id = p_entry_id for update;
  if v_entry.status not in ('waiting', 'offered') then
    raise exception 'Non sei più in lista d''attesa per questa giornata.' using errcode = 'P0001', hint = 'entry_not_active';
  end if;

  update public.seat_offers
     set status = 'declined', responded_at = now(), used_at = coalesce(used_at, now()), end_reason = 'Uscita dalla lista'
   where waitlist_entry_id = v_entry.id and status = 'pending';
  update public.waitlist_entries set status = 'withdrawn', end_reason = 'Uscita dello studente' where id = v_entry.id;

  perform public.process_day_waitlist(v_day_id);
end;
$$;

-- ---------------------------------------------------------------------
-- Conferma e rinuncia di una proposta
-- ---------------------------------------------------------------------
create or replace function public.accept_offer_internal(p_offer_id uuid, p_student_id uuid)
returns public.bookings
language plpgsql security definer set search_path = ''
as $$
declare
  v_day_id  uuid;
  v_day     public.school_days;
  v_offer   public.seat_offers;
  v_booking public.bookings;
begin
  select school_day_id into v_day_id from public.seat_offers
   where id = p_offer_id and (p_student_id is null or student_id = p_student_id);
  if v_day_id is null then
    raise exception 'Proposta non trovata.' using errcode = 'P0002', hint = 'offer_not_found';
  end if;

  -- prima la giornata, poi la proposta: conferme simultanee in fila
  select * into v_day from public.school_days where id = v_day_id for update;
  select * into v_offer from public.seat_offers where id = p_offer_id for update;

  if v_offer.status = 'accepted' then
    raise exception 'Hai già confermato questo posto.' using errcode = 'P0001', hint = 'offer_already_accepted';
  elsif v_offer.status = 'expired' then
    raise exception 'La proposta è scaduta.' using errcode = 'P0001', hint = 'offer_expired';
  elsif v_offer.status <> 'pending' then
    raise exception 'La proposta non è più valida.' using errcode = 'P0001', hint = 'offer_not_valid';
  end if;
  if v_offer.expires_at <= now() then
    raise exception 'La proposta è scaduta.' using errcode = 'P0001', hint = 'offer_expired';
  end if;
  if not v_day.is_open then
    raise exception 'L''aula studio è chiusa in questa giornata.' using errcode = 'P0001', hint = 'day_closed';
  end if;
  -- controllo difensivo della capienza (il posto è trattenuto dalla proposta)
  if public.day_confirmed_seats(v_day.id) >= v_day.capacity then
    raise exception 'È stato raggiunto il numero massimo di % prenotazioni.', v_day.capacity using errcode = 'P0001', hint = 'capacity_reached';
  end if;

  insert into public.bookings (student_id, school_day_id, status, source, created_by)
  values (v_offer.student_id, v_day.id, 'confirmed', 'waitlist_offer', v_offer.student_id)
  returning * into v_booking;

  update public.seat_offers
     set status = 'accepted', booking_id = v_booking.id, responded_at = now(), used_at = now()
   where id = v_offer.id;
  update public.waitlist_entries set status = 'assigned', end_reason = 'Posto confermato' where id = v_offer.waitlist_entry_id;

  perform public.enqueue_notification('offer_confirmed', v_offer.student_id, jsonb_build_object(
    'booking_id', v_booking.id, 'day', v_day.day,
    'opens_at', to_char(v_day.opens_at, 'HH24:MI'), 'closes_at', to_char(v_day.closes_at, 'HH24:MI'),
    'cancel_deadline', public.cancellation_deadline(v_day.day, v_day.opens_at)));
  return v_booking;
exception
  when unique_violation then
    raise exception 'Hai già una prenotazione per questa giornata.' using errcode = 'P0001', hint = 'already_booked';
end;
$$;

create or replace function public.decline_offer_internal(p_offer_id uuid, p_student_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_day_id uuid;
  v_offer  public.seat_offers;
begin
  select school_day_id into v_day_id from public.seat_offers
   where id = p_offer_id and (p_student_id is null or student_id = p_student_id);
  if v_day_id is null then
    raise exception 'Proposta non trovata.' using errcode = 'P0002', hint = 'offer_not_found';
  end if;
  perform 1 from public.school_days where id = v_day_id for update;
  select * into v_offer from public.seat_offers where id = p_offer_id for update;
  if v_offer.status <> 'pending' then
    raise exception 'La proposta non è più valida.' using errcode = 'P0001', hint = 'offer_not_valid';
  end if;

  update public.seat_offers
     set status = 'declined', responded_at = now(), used_at = now(), end_reason = 'Rinuncia dello studente'
   where id = v_offer.id;
  update public.waitlist_entries set status = 'withdrawn', end_reason = 'Rinuncia alla proposta' where id = v_offer.waitlist_entry_id;
  perform public.process_day_waitlist(v_day_id);
end;
$$;

-- dall'area personale (studente collegato)
create or replace function public.accept_my_offer(p_offer_id uuid)
returns public.bookings
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Accesso richiesto.' using errcode = '42501', hint = 'not_authenticated';
  end if;
  return public.accept_offer_internal(p_offer_id, (select auth.uid()));
end;
$$;

create or replace function public.decline_my_offer(p_offer_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Accesso richiesto.' using errcode = '42501', hint = 'not_authenticated';
  end if;
  perform public.decline_offer_internal(p_offer_id, (select auth.uid()));
end;
$$;

-- dal link personale ricevuto via email (solo server, service role)
create or replace function public.offer_id_from_token(p_token text)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.seat_offers
   where p_token ~ '^[0-9a-f]{64}$'
     and token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

create or replace function public.get_offer_by_token(p_token text)
returns table (
  offer_id uuid, status public.offer_status, offered_at timestamptz, expires_at timestamptz, used_at timestamptz,
  day date, opens_at time, closes_at time, day_is_open boolean, first_name text
)
language sql stable security definer set search_path = ''
as $$
  select o.id, o.status, o.offered_at, o.expires_at, o.used_at, d.day, d.opens_at, d.closes_at, d.is_open, s.first_name
    from public.seat_offers o
    join public.school_days d on d.id = o.school_day_id
    join public.students s on s.id = o.student_id
   where o.id = public.offer_id_from_token(p_token);
$$;

create or replace function public.accept_offer_by_token(p_token text)
returns public.bookings
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid := public.offer_id_from_token(p_token);
begin
  if v_id is null then
    raise exception 'Link non valido.' using errcode = 'P0002', hint = 'offer_not_found';
  end if;
  return public.accept_offer_internal(v_id, null);
end;
$$;

create or replace function public.decline_offer_by_token(p_token text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid := public.offer_id_from_token(p_token);
begin
  if v_id is null then
    raise exception 'Link non valido.' using errcode = 'P0002', hint = 'offer_not_found';
  end if;
  perform public.decline_offer_internal(v_id, null);
end;
$$;

-- ---------------------------------------------------------------------
-- Liste d'attesa dello studente collegato
-- ---------------------------------------------------------------------
create or replace function public.my_waitlist()
returns table (
  entry_id uuid, entry_status public.waitlist_status, joined_at timestamptz, queue_position integer, waiting_total integer,
  school_day_id uuid, day date, opens_at time, closes_at time, day_is_open boolean, waitlist_paused boolean,
  offer_id uuid, offer_status public.offer_status, offered_at timestamptz, offer_expires_at timestamptz, end_reason text
)
language sql stable security definer set search_path = ''
as $$
  select e.id, e.status, e.joined_at, public.waitlist_position(e.id),
         (select count(*)::integer from public.waitlist_entries w where w.school_day_id = e.school_day_id and w.status = 'waiting'),
         d.id, d.day, d.opens_at, d.closes_at, d.is_open, d.waitlist_paused,
         o.id, o.status, o.offered_at, o.expires_at, coalesce(o.end_reason, e.end_reason)
    from public.waitlist_entries e
    join public.school_days d on d.id = e.school_day_id
    left join lateral (
      select * from public.seat_offers so where so.waitlist_entry_id = e.id order by so.offered_at desc limit 1
    ) o on true
   where e.student_id = (select auth.uid())
     and d.day >= public.school_today()
   order by d.day, e.queue_seq;
$$;

-- ---------------------------------------------------------------------
-- Funzioni dei docenti
-- ---------------------------------------------------------------------
create or replace function public.set_waitlist_paused(p_school_day_id uuid, p_paused boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_teacher() then
    raise exception 'Operazione riservata ai docenti.' using errcode = '42501', hint = 'not_teacher';
  end if;
  update public.school_days set waitlist_paused = p_paused, updated_by = (select auth.uid()) where id = p_school_day_id;
  if not found then
    raise exception 'Giornata inesistente.' using errcode = 'P0002', hint = 'day_not_found';
  end if;
end;
$$;

create or replace function public.teacher_remove_waitlist_entry(p_entry_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_day_id uuid;
  v_entry  public.waitlist_entries;
begin
  if not public.is_teacher() then
    raise exception 'Operazione riservata ai docenti.' using errcode = '42501', hint = 'not_teacher';
  end if;
  select school_day_id into v_day_id from public.waitlist_entries where id = p_entry_id;
  if v_day_id is null then
    raise exception 'Iscrizione non trovata.' using errcode = 'P0002', hint = 'entry_not_found';
  end if;
  perform 1 from public.school_days where id = v_day_id for update;
  select * into v_entry from public.waitlist_entries where id = p_entry_id for update;
  if v_entry.status not in ('waiting', 'offered') then
    raise exception 'Lo studente non è più in lista.' using errcode = 'P0001', hint = 'entry_not_active';
  end if;
  update public.seat_offers
     set status = 'revoked', responded_at = now(), end_reason = 'Rimosso dal docente'
   where waitlist_entry_id = v_entry.id and status = 'pending';
  update public.waitlist_entries set status = 'withdrawn', end_reason = 'Rimosso dal docente' where id = v_entry.id;
  perform public.process_day_waitlist(v_day_id);
end;
$$;

create or replace function public.set_offer_minutes(p_minutes integer)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_teacher() then
    raise exception 'Operazione riservata ai docenti.' using errcode = '42501', hint = 'not_teacher';
  end if;
  if p_minutes is null or p_minutes not between 15 and 720 then
    raise exception 'Il tempo di conferma deve essere tra 15 minuti e 12 ore.' using errcode = '22023', hint = 'invalid_minutes';
  end if;
  update public.app_settings set offer_minutes = p_minutes, updated_by = (select auth.uid()) where id = 1;
end;
$$;

-- ---------------------------------------------------------------------
-- Cambiamenti di una giornata: chiusura, riapertura, capienza, sospensione
-- ---------------------------------------------------------------------
create or replace function public.after_school_day_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  v_payload jsonb;
begin
  if old.is_open and not new.is_open then
    v_payload := jsonb_build_object('day', new.day, 'reason', coalesce(new.closure_reason, ''));
    -- proposte aperte annullate; gli studenti tornano in coda con la loro posizione
    for r in select id, waitlist_entry_id from public.seat_offers where school_day_id = new.id and status = 'pending' for update loop
      update public.seat_offers set status = 'revoked', responded_at = now(), end_reason = 'Giornata chiusa' where id = r.id;
      update public.waitlist_entries set status = 'waiting' where id = r.waitlist_entry_id;
    end loop;
    for r in select student_id from public.bookings where school_day_id = new.id and status = 'confirmed' loop
      perform public.enqueue_notification('day_closed_booked', r.student_id, v_payload);
    end loop;
    for r in select student_id from public.waitlist_entries where school_day_id = new.id and status = 'waiting' loop
      perform public.enqueue_notification('day_closed_waitlist', r.student_id, v_payload);
    end loop;
  elsif (new.is_open and not old.is_open)
     or (new.is_open and new.capacity > old.capacity)
     or (old.waitlist_paused and not new.waitlist_paused) then
    perform public.process_day_waitlist(new.id);
  end if;
  return new;
end;
$$;

create trigger after_school_day_change
  after update of is_open, capacity, waitlist_paused on public.school_days
  for each row execute function public.after_school_day_change();

-- ---------------------------------------------------------------------
-- Manutenzione automatica (Supabase Cron, ogni minuto)
-- ---------------------------------------------------------------------
create or replace function public.run_waitlist_maintenance()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r          record;
  v_offer    public.seat_offers;
  v_expired  integer := 0;
  v_offers   integer := 0;
  v_past     integer;
begin
  -- 1. proposte scadute → la proposta scade e il posto passa al successivo
  for r in select id, school_day_id from public.seat_offers where status = 'pending' and expires_at <= now() order by expires_at loop
    perform 1 from public.school_days where id = r.school_day_id for update;
    select * into v_offer from public.seat_offers where id = r.id for update;
    continue when v_offer.status <> 'pending' or v_offer.expires_at > now();

    update public.seat_offers set status = 'expired', end_reason = 'Nessuna conferma entro il tempo previsto' where id = v_offer.id;
    update public.waitlist_entries set status = 'expired', end_reason = 'Proposta scaduta' where id = v_offer.waitlist_entry_id;
    perform public.enqueue_notification('offer_expired', v_offer.student_id, jsonb_build_object(
      'day', (select day from public.school_days where id = v_offer.school_day_id)));
    v_expired := v_expired + 1;
    -- il successivo solo se si è ancora prima della soglia delle 24 ore
    v_offers := v_offers + public.process_day_waitlist(v_offer.school_day_id);
  end loop;

  -- 2. rete di sicurezza: posti liberi con studenti in attesa (es. lista riattivata)
  for r in
    select distinct w.school_day_id from public.waitlist_entries w
      join public.school_days d on d.id = w.school_day_id
     where w.status = 'waiting' and d.day >= public.school_today() and d.is_open and not d.waitlist_paused
  loop
    v_offers := v_offers + public.process_day_waitlist(r.school_day_id);
  end loop;

  -- 3. giornate passate: le iscrizioni ancora in attesa si chiudono
  update public.waitlist_entries w
     set status = 'expired', end_reason = 'Giornata conclusa'
    from public.school_days d
   where d.id = w.school_day_id and w.status = 'waiting' and d.day < public.school_today();
  get diagnostics v_past = row_count;

  -- 4. email rimaste "in invio" da più di 10 minuti tornano in coda
  update public.notification_outbox set status = 'pending' where status = 'sending' and claimed_at < now() - interval '10 minutes';

  return jsonb_build_object('expired_offers', v_expired, 'new_offers', v_offers, 'closed_entries', v_past, 'at', now());
end;
$$;

-- ---------------------------------------------------------------------
-- Invio delle email: il server prende in carico le notifiche in modo atomico
-- ---------------------------------------------------------------------
create or replace function public.claim_notifications(p_limit integer default 20)
returns setof public.notification_outbox
language sql security definer set search_path = ''
as $$
  update public.notification_outbox n
     set status = 'sending', claimed_at = now(), attempts = n.attempts + 1
   where n.id in (
     select id from public.notification_outbox
      where status = 'pending' and attempts < 5
      order by id
      limit greatest(1, least(p_limit, 100))
      for update skip locked)
  returning n.*;
$$;

create or replace function public.complete_notification(p_id bigint, p_ok boolean, p_provider_id text, p_error text)
returns void
language sql security definer set search_path = ''
as $$
  update public.notification_outbox
     set status = case when p_ok then 'sent' when attempts >= 5 then 'failed' else 'pending' end,
         sent_at = case when p_ok then now() else sent_at end,
         provider_id = coalesce(p_provider_id, provider_id),
         last_error = case when p_ok then null else left(p_error, 500) end,
         payload = case when p_ok then payload - 'token' else payload end   -- il token in chiaro non resta salvato
   where id = p_id;
$$;

-- ---------------------------------------------------------------------
-- Disponibilità: ora include i posti trattenuti e lo stato della lista
-- ---------------------------------------------------------------------
drop function public.get_day_availability(date, date);
create function public.get_day_availability(p_from date, p_to date)
returns table (
  school_day_id   uuid,
  day             date,
  is_open         boolean,
  capacity        integer,
  booked          integer,
  held            integer,
  available       integer,
  waiting         integer,
  waitlist_open   boolean,
  opens_at        time,
  closes_at       time,
  closure_reason  text,
  note            text
)
language sql stable security definer set search_path = ''
as $$
  select d.id, d.day, d.is_open, d.capacity,
         coalesce(b.n, 0)::integer,
         coalesce(o.n, 0)::integer,
         case when d.is_open then greatest(d.capacity - coalesce(b.n, 0) - coalesce(o.n, 0), 0) else 0 end::integer,
         coalesce(w.n, 0)::integer,
         d.is_open and not d.waitlist_paused and now() < public.cancellation_deadline(d.day, d.opens_at),
         d.opens_at, d.closes_at, d.closure_reason, d.note
    from public.school_days d
    left join (select school_day_id, count(*) n from public.bookings where status = 'confirmed' group by school_day_id) b on b.school_day_id = d.id
    left join (select school_day_id, count(*) n from public.seat_offers where status = 'pending' group by school_day_id) o on o.school_day_id = d.id
    left join (select school_day_id, count(*) n from public.waitlist_entries where status = 'waiting' group by school_day_id) w on w.school_day_id = d.id
   where d.day between p_from and p_to
   order by d.day;
$$;
comment on function public.get_day_availability(date, date) is 'Posti per giornata: solo conteggi, mai dati personali.';

-- ---------------------------------------------------------------------
-- Privilegi (Supabase concede di default EXECUTE a tutti i ruoli API)
-- ---------------------------------------------------------------------
revoke all on public.notification_outbox from public, anon, authenticated;
revoke all on sequence public.notification_outbox_id_seq from public, anon, authenticated;

revoke execute on function
  public.enqueue_notification(text, uuid, jsonb), public.day_held_seats(uuid), public.day_confirmed_seats(uuid),
  public.process_day_waitlist(uuid), public.after_booking_cancelled(), public.after_school_day_change(),
  public.accept_offer_internal(uuid, uuid), public.decline_offer_internal(uuid, uuid),
  public.offer_id_from_token(text), public.get_offer_by_token(text),
  public.accept_offer_by_token(text), public.decline_offer_by_token(text),
  public.run_waitlist_maintenance(), public.claim_notifications(integer),
  public.complete_notification(bigint, boolean, text, text), public.waitlist_position(uuid)
  from public, anon, authenticated;

revoke execute on function
  public.join_waitlist(uuid), public.leave_waitlist(uuid), public.my_waitlist(),
  public.accept_my_offer(uuid), public.decline_my_offer(uuid),
  public.set_waitlist_paused(uuid, boolean), public.teacher_remove_waitlist_entry(uuid), public.set_offer_minutes(integer),
  public.get_day_availability(date, date)
  from public, anon;
grant execute on function
  public.join_waitlist(uuid), public.leave_waitlist(uuid), public.my_waitlist(),
  public.accept_my_offer(uuid), public.decline_my_offer(uuid),
  public.set_waitlist_paused(uuid, boolean), public.teacher_remove_waitlist_entry(uuid), public.set_offer_minutes(integer),
  public.get_day_availability(date, date)
  to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update on public.notification_outbox to service_role;
    grant execute on function
      public.get_offer_by_token(text), public.accept_offer_by_token(text), public.decline_offer_by_token(text),
      public.run_waitlist_maintenance(), public.claim_notifications(integer),
      public.complete_notification(bigint, boolean, text, text)
      to service_role;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Supabase Cron: manutenzione ogni minuto, anche senza utenti collegati.
-- Se pg_cron non è disponibile la migrazione prosegue: va attivato da
-- Dashboard → Integrations → Cron e poi eseguito il blocco qui sotto
-- (vedi README).
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.schedule('bibliovolta-waitlist', '* * * * *', 'select public.run_waitlist_maintenance()');
    exception when others then
      raise notice 'BIBLIOVOLTA: pianificazione pg_cron non riuscita (%). Attivala dal pannello Supabase (README).', sqlerrm;
    end;
  else
    raise notice 'BIBLIOVOLTA: pg_cron non disponibile in questo database. Attivalo dal pannello Supabase (README).';
  end if;
end;
$$;
