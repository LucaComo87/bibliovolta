-- =====================================================================
-- BIBLIOVOLTA · Migrazione 6 · Prenotazioni reali (Fase 4)
-- =====================================================================
--  * festività nazionali chiuse fin dall'inizio;
--  * book_seat: prenotazione atomica (blocco della riga della giornata),
--    mai più di 50 prenotazioni attive, una sola per studente e giornata;
--  * cancel_booking: annullamento entro 24 ore dall'apertura, calcolato
--    nel fuso Europe/Rome (ora solare e legale gestite dal database);
--  * set_opening_hours: i docenti cambiano l'orario di apertura.
-- Gli studenti NON scrivono mai direttamente nella tabella bookings.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Festività nazionali 2026/27 (le altre sospensioni le configurano i docenti)
-- ---------------------------------------------------------------------
update public.school_days d
   set is_open = false,
       closure_reason = f.reason
  from (values
    (date '2026-12-08', 'Immacolata Concezione'),
    (date '2026-12-25', 'Natale'),
    (date '2027-01-01', 'Capodanno'),
    (date '2027-01-06', 'Epifania'),
    (date '2027-03-29', 'Lunedì dell''Angelo'),
    (date '2027-06-02', 'Festa della Repubblica')
  ) as f(day, reason)
 where d.day = f.day
   and d.is_open
   and not exists (select 1 from public.bookings b where b.school_day_id = d.id and b.status = 'confirmed');

-- ---------------------------------------------------------------------
-- Orari in Europe/Rome
-- ---------------------------------------------------------------------
create or replace function public.school_today()
returns date
language sql stable set search_path = ''
as $$
  select (now() at time zone (select s.school_timezone from public.app_settings s where s.id = 1))::date;
$$;

/** Istante di apertura della giornata (data + orario interpretati in Europe/Rome). */
create or replace function public.day_opening_at(p_day date, p_opens_at time)
returns timestamptz
language sql stable set search_path = ''
as $$
  select (p_day + p_opens_at) at time zone (select s.school_timezone from public.app_settings s where s.id = 1);
$$;

/** Limite per annullare: apertura meno cancellation_hours (24). */
create or replace function public.cancellation_deadline(p_day date, p_opens_at time)
returns timestamptz
language sql stable set search_path = ''
as $$
  select public.day_opening_at(p_day, p_opens_at)
       - make_interval(hours => (select s.cancellation_hours from public.app_settings s where s.id = 1));
$$;

-- ---------------------------------------------------------------------
-- Prenotazione (atomica)
-- ---------------------------------------------------------------------
create or replace function public.book_seat(p_school_day_id uuid)
returns public.bookings
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_student public.students;
  v_day     public.school_days;
  v_booked  integer;
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

  -- Blocco esclusivo della giornata: le prenotazioni concorrenti della
  -- stessa giornata vengono messe in fila e rilette una alla volta.
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

  if exists (
    select 1 from public.bookings
     where student_id = v_uid and school_day_id = v_day.id and status = 'confirmed'
  ) then
    raise exception 'Hai già una prenotazione per questa giornata.' using errcode = 'P0001', hint = 'already_booked';
  end if;

  select count(*) into v_booked
    from public.bookings
   where school_day_id = v_day.id and status = 'confirmed';
  if v_booked >= v_day.capacity then
    raise exception 'È stato raggiunto il numero massimo di % prenotazioni. Puoi iscriverti alla lista d''attesa.', v_day.capacity
      using errcode = 'P0001', hint = 'capacity_reached';
  end if;

  insert into public.bookings (student_id, school_day_id, status, source, created_by)
  values (v_uid, v_day.id, 'confirmed', 'student', v_uid)
  returning * into v_row;
  return v_row;
exception
  when unique_violation then
    -- difesa ulteriore: indice univoco "una prenotazione attiva per giornata"
    raise exception 'Hai già una prenotazione per questa giornata.' using errcode = 'P0001', hint = 'already_booked';
end;
$$;

-- ---------------------------------------------------------------------
-- Annullamento (solo le proprie, entro 24 ore dall'apertura)
-- ---------------------------------------------------------------------
create or replace function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_booking public.bookings;
  v_day     public.school_days;
begin
  if v_uid is null then
    raise exception 'Accesso richiesto.' using errcode = '42501', hint = 'not_authenticated';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id and student_id = v_uid for update;
  if not found then
    raise exception 'Prenotazione non trovata.' using errcode = 'P0002', hint = 'booking_not_found';
  end if;
  if v_booking.status <> 'confirmed' then
    raise exception 'La prenotazione è già stata annullata.' using errcode = 'P0001', hint = 'already_cancelled';
  end if;

  select * into v_day from public.school_days where id = v_booking.school_day_id for update;
  if now() >= public.cancellation_deadline(v_day.day, v_day.opens_at) then
    raise exception 'Non è più possibile annullare: mancano meno di % ore all''apertura.',
      (select s.cancellation_hours from public.app_settings s where s.id = 1)
      using errcode = 'P0001', hint = 'cancel_deadline_passed';
  end if;

  update public.bookings
     set status = 'cancelled', cancelled_at = now(), cancelled_by = v_uid, cancel_reason = 'Annullata dallo studente'
   where id = v_booking.id
  returning * into v_booking;
  return v_booking;
end;
$$;

-- ---------------------------------------------------------------------
-- Prenotazioni dello studente collegato, con i dati della giornata
-- ---------------------------------------------------------------------
create or replace function public.my_bookings()
returns table (
  booking_id      uuid,
  status          public.booking_status,
  created_at      timestamptz,
  cancelled_at    timestamptz,
  school_day_id   uuid,
  day             date,
  opens_at        time,
  closes_at       time,
  day_is_open     boolean,
  cancel_deadline timestamptz,
  can_cancel      boolean
)
language sql stable security definer set search_path = ''
as $$
  select b.id, b.status, b.created_at, b.cancelled_at, d.id, d.day, d.opens_at, d.closes_at, d.is_open,
         public.cancellation_deadline(d.day, d.opens_at),
         b.status = 'confirmed' and now() < public.cancellation_deadline(d.day, d.opens_at)
    from public.bookings b
    join public.school_days d on d.id = b.school_day_id
   where b.student_id = (select auth.uid())
   order by d.day, b.created_at;
$$;

-- ---------------------------------------------------------------------
-- Orario di apertura (docenti): nuovo predefinito + giornate future
-- ---------------------------------------------------------------------
create or replace function public.set_opening_hours(p_opens_at time, p_closes_at time)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_teacher() then
    raise exception 'Operazione riservata ai docenti.' using errcode = '42501', hint = 'not_teacher';
  end if;
  if p_opens_at is null or p_closes_at is null or p_closes_at <= p_opens_at then
    raise exception 'L''orario di chiusura deve essere successivo a quello di apertura.' using errcode = '22023', hint = 'invalid_hours';
  end if;

  update public.app_settings
     set default_opens_at = p_opens_at, default_closes_at = p_closes_at, updated_by = (select auth.uid())
   where id = 1;

  update public.school_days
     set opens_at = p_opens_at, closes_at = p_closes_at, updated_by = (select auth.uid())
   where day > public.school_today();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- Privilegi
-- ---------------------------------------------------------------------
revoke execute on function
  public.school_today(), public.day_opening_at(date, time), public.cancellation_deadline(date, time),
  public.book_seat(uuid), public.cancel_booking(uuid), public.my_bookings(), public.set_opening_hours(time, time)
  from public, anon;
grant execute on function
  public.school_today(), public.day_opening_at(date, time), public.cancellation_deadline(date, time),
  public.book_seat(uuid), public.cancel_booking(uuid), public.my_bookings(), public.set_opening_hours(time, time)
  to authenticated;
