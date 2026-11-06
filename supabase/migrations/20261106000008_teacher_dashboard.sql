-- =====================================================================
-- BIBLIOVOLTA · Migrazione 8 · Dashboard docenti e comunicazioni (Fase 6)
-- =====================================================================
--  * registro delle operazioni dei docenti (voci leggibili "docente.*"
--    in audit_log, accanto al registro tecnico riga per riga);
--  * gestione delle giornate in un'unica funzione: apertura, chiusura con
--    motivo e comunicazione (predefinita, personalizzata o nessuna),
--    capienza, orario, nota;
--  * annullamento manuale di una prenotazione con motivo ed email;
--  * comunicazioni email ai prenotati e/o agli studenti in lista d'attesa,
--    con esito registrato per ogni destinatario e nuovo invio dei falliti;
--  * statistiche per la dashboard.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Comunicazioni: destinatari per giornata (prenotati e/o lista d'attesa)
-- ---------------------------------------------------------------------
alter table public.announcements
  add column include_bookings boolean not null default true,
  add column include_waitlist boolean not null default false,
  add column recipients_count integer not null default 0;

-- coda email: nuovi tipi e collegamento al destinatario della comunicazione
alter table public.notification_outbox drop constraint notification_outbox_kind_check;
alter table public.notification_outbox add constraint notification_outbox_kind_check check (kind in (
  'waitlist_offer', 'offer_confirmed', 'offer_expired', 'day_closed_booked', 'day_closed_waitlist',
  'announcement', 'booking_cancelled'));
alter table public.notification_outbox
  add column delivery_id uuid references public.announcement_deliveries (id) on delete set null;
create index notification_outbox_delivery_idx on public.notification_outbox (delivery_id) where delivery_id is not null;

-- ---------------------------------------------------------------------
-- Registro leggibile delle operazioni dei docenti
-- ---------------------------------------------------------------------
create or replace function public.log_teacher_action(p_action text, p_entity_type text, p_entity_id text, p_details jsonb)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'teacher', 'docente.' || p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;

create or replace function public.require_teacher()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_teacher() then
    raise exception 'Operazione riservata ai docenti.' using errcode = '42501', hint = 'not_teacher';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Creazione di una comunicazione: destinatari, esiti, coda email
-- ---------------------------------------------------------------------
create or replace function public.create_day_announcement(
  p_school_day_id uuid, p_include_bookings boolean, p_include_waitlist boolean, p_subject text, p_body text, p_category text
)
returns table (announcement_id uuid, recipients integer)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_day     public.school_days;
  v_author  text;
  v_ann     public.announcements;
  v_count   integer;
begin
  select * into v_day from public.school_days where id = p_school_day_id;
  if not found then
    raise exception 'Giornata inesistente.' using errcode = 'P0002', hint = 'day_not_found';
  end if;
  select coalesce(nullif(t.full_name, ''), t.email) into v_author from public.teachers t where t.id = v_uid;

  insert into public.announcements (author_id, title, body, audience, school_day_id, send_email, published_at, include_bookings, include_waitlist)
  values (v_uid, p_subject, p_body, 'day_bookings', v_day.id, true, now(), p_include_bookings, p_include_waitlist)
  returning * into v_ann;

  insert into public.announcement_deliveries (announcement_id, student_id, email_status)
  select v_ann.id, r.student_id, 'pending'
    from (
      select b.student_id from public.bookings b
       where p_include_bookings and b.school_day_id = v_day.id and b.status = 'confirmed'
      union
      select w.student_id from public.waitlist_entries w
       where p_include_waitlist and w.school_day_id = v_day.id and w.status in ('waiting', 'offered')
    ) r
  on conflict do nothing;
  get diagnostics v_count = row_count;

  update public.announcements set recipients_count = v_count where id = v_ann.id;

  insert into public.notification_outbox (kind, student_id, to_email, payload, delivery_id)
  select 'announcement', s.id, s.email,
         jsonb_build_object('subject', p_subject, 'body', p_body, 'day', v_day.day, 'author', coalesce(v_author, ''),
                            'category', coalesce(p_category, ''), 'first_name', coalesce(s.first_name, ''), 'last_name', coalesce(s.last_name, '')),
         d.id
    from public.announcement_deliveries d
    join public.students s on s.id = d.student_id
   where d.announcement_id = v_ann.id;

  return query select v_ann.id, v_count;
end;
$$;

-- Numero di destinatari (per l'anteprima, prima di inviare)
create or replace function public.announcement_recipients_count(p_school_day_id uuid, p_include_bookings boolean, p_include_waitlist boolean)
returns integer
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.require_teacher();
  return (
    select count(*)::integer from (
      select b.student_id from public.bookings b
       where p_include_bookings and b.school_day_id = p_school_day_id and b.status = 'confirmed'
      union
      select w.student_id from public.waitlist_entries w
       where p_include_waitlist and w.school_day_id = p_school_day_id and w.status in ('waiting', 'offered')
    ) r);
end;
$$;

create or replace function public.send_announcement(
  p_school_day_id uuid, p_include_bookings boolean, p_include_waitlist boolean, p_subject text, p_body text, p_category text default null
)
returns table (announcement_id uuid, recipients integer)
language plpgsql security definer set search_path = ''
as $$
declare
  v_subject text := btrim(coalesce(p_subject, ''));
  v_body    text := btrim(coalesce(p_body, ''));
  v_res     record;
begin
  perform public.require_teacher();
  if length(v_subject) not between 3 and 150 then
    raise exception 'L''oggetto deve avere tra 3 e 150 caratteri.' using errcode = '22023', hint = 'invalid_subject';
  end if;
  if length(v_body) not between 5 and 5000 then
    raise exception 'Il messaggio deve avere tra 5 e 5000 caratteri.' using errcode = '22023', hint = 'invalid_body';
  end if;
  if not (coalesce(p_include_bookings, false) or coalesce(p_include_waitlist, false)) then
    raise exception 'Scegli almeno un gruppo di destinatari.' using errcode = '22023', hint = 'no_audience';
  end if;
  if public.announcement_recipients_count(p_school_day_id, p_include_bookings, p_include_waitlist) = 0 then
    raise exception 'Nessun destinatario per questa giornata.' using errcode = 'P0001', hint = 'no_recipients';
  end if;

  select * into v_res from public.create_day_announcement(p_school_day_id, p_include_bookings, p_include_waitlist, v_subject, v_body, p_category);
  perform public.log_teacher_action('comunicazione_inviata', 'announcements', v_res.announcement_id::text, jsonb_build_object(
    'day', (select day from public.school_days where id = p_school_day_id), 'subject', v_subject,
    'recipients', v_res.recipients, 'prenotati', p_include_bookings, 'lista_attesa', p_include_waitlist, 'categoria', p_category));
  return query select v_res.announcement_id, v_res.recipients;
end;
$$;

-- Nuovo invio delle email non riuscite di una comunicazione
create or replace function public.retry_announcement(p_announcement_id uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  perform public.require_teacher();
  update public.notification_outbox o
     set status = 'pending', attempts = 0, last_error = null
    from public.announcement_deliveries d
   where d.id = o.delivery_id and d.announcement_id = p_announcement_id and o.status = 'failed';
  get diagnostics v_count = row_count;
  update public.announcement_deliveries set email_status = 'pending', email_error = null
   where announcement_id = p_announcement_id and email_status = 'failed';
  perform public.log_teacher_action('comunicazione_reinvio', 'announcements', p_announcement_id::text, jsonb_build_object('email', v_count));
  return v_count;
end;
$$;

-- Esito dell'invio: aggiorna anche il destinatario della comunicazione
-- p_permanent: errore definitivo (es. indirizzo rifiutato dal servizio email):
-- nessun nuovo tentativo, l'esito "non inviata" è registrato subito.
drop function if exists public.complete_notification(bigint, boolean, text, text);
create or replace function public.complete_notification(p_id bigint, p_ok boolean, p_provider_id text, p_error text, p_permanent boolean default false)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.notification_outbox;
begin
  update public.notification_outbox
     set status = case when p_ok then 'sent' when p_permanent or attempts >= 5 then 'failed' else 'pending' end,
         sent_at = case when p_ok then now() else sent_at end,
         provider_id = coalesce(p_provider_id, provider_id),
         last_error = case when p_ok then null else left(p_error, 500) end,
         payload = case when p_ok then payload - 'token' else payload end
   where id = p_id
  returning * into v_row;

  if v_row.delivery_id is not null then
    update public.announcement_deliveries
       set email_status = case v_row.status when 'sent' then 'sent'::public.delivery_status when 'failed' then 'failed'::public.delivery_status else 'pending'::public.delivery_status end,
           email_provider_id = coalesce(p_provider_id, email_provider_id),
           email_error = case when p_ok then null else left(p_error, 500) end,
           sent_at = case when p_ok then now() else sent_at end
     where id = v_row.delivery_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Chiusura: avvisi predefiniti solo se il docente non ha scelto altro
-- (bibliovolta.closure_notice = 'custom' | 'none' impostato da teacher_update_day)
-- ---------------------------------------------------------------------
create or replace function public.after_school_day_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  v_payload jsonb;
  v_notice  text := coalesce(nullif(current_setting('bibliovolta.closure_notice', true), ''), 'default');
begin
  if old.is_open and not new.is_open then
    v_payload := jsonb_build_object('day', new.day, 'reason', coalesce(new.closure_reason, ''));
    for r in select id, waitlist_entry_id from public.seat_offers where school_day_id = new.id and status = 'pending' for update loop
      update public.seat_offers set status = 'revoked', responded_at = now(), end_reason = 'Giornata chiusa' where id = r.id;
      update public.waitlist_entries set status = 'waiting' where id = r.waitlist_entry_id;
    end loop;
    if v_notice = 'default' then
      for r in select student_id from public.bookings where school_day_id = new.id and status = 'confirmed' loop
        perform public.enqueue_notification('day_closed_booked', r.student_id, v_payload);
      end loop;
      for r in select student_id from public.waitlist_entries where school_day_id = new.id and status = 'waiting' loop
        perform public.enqueue_notification('day_closed_waitlist', r.student_id, v_payload);
      end loop;
    end if;
  elsif (new.is_open and not old.is_open)
     or (new.is_open and new.capacity > old.capacity)
     or (old.waitlist_paused and not new.waitlist_paused) then
    perform public.process_day_waitlist(new.id);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Gestione di una giornata (calendario gestionale)
-- ---------------------------------------------------------------------
create or replace function public.teacher_update_day(
  p_school_day_id uuid,
  p_is_open boolean,
  p_capacity integer,
  p_opens_at time,
  p_closes_at time,
  p_note text,
  p_closure_reason text,
  p_notice text default 'default',      -- 'default' | 'custom' | 'none' (solo per la chiusura)
  p_subject text default null,
  p_message text default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_old     public.school_days;
  v_new     public.school_days;
  v_reason  text := nullif(btrim(coalesce(p_closure_reason, '')), '');
  v_booked  integer;
  v_waiting integer;
  v_sent    integer := 0;
  v_changes jsonb := '{}'::jsonb;
  v_res     record;
begin
  perform public.require_teacher();
  if p_notice not in ('default', 'custom', 'none') then
    raise exception 'Scelta di comunicazione non valida.' using errcode = '22023', hint = 'invalid_notice';
  end if;
  select * into v_old from public.school_days where id = p_school_day_id for update;
  if not found then
    raise exception 'Giornata inesistente.' using errcode = 'P0002', hint = 'day_not_found';
  end if;
  if not p_is_open and v_reason is null then
    raise exception 'Indica il motivo della chiusura.' using errcode = '22023', hint = 'reason_required';
  end if;
  if p_closes_at <= p_opens_at then
    raise exception 'L''orario di chiusura deve essere successivo a quello di apertura.' using errcode = '22023', hint = 'invalid_hours';
  end if;
  if not p_is_open and p_notice = 'custom' and (length(btrim(coalesce(p_subject, ''))) < 3 or length(btrim(coalesce(p_message, ''))) < 5) then
    raise exception 'Scrivi oggetto e messaggio della comunicazione.' using errcode = '22023', hint = 'invalid_message';
  end if;

  v_booked := public.day_confirmed_seats(v_old.id);
  select count(*)::integer into v_waiting from public.waitlist_entries where school_day_id = v_old.id and status in ('waiting', 'offered');

  perform set_config('bibliovolta.closure_notice', p_notice, true);
  update public.school_days
     set is_open = p_is_open,
         closure_reason = case when p_is_open then null else v_reason end,
         capacity = p_capacity,
         opens_at = p_opens_at,
         closes_at = p_closes_at,
         note = nullif(btrim(coalesce(p_note, '')), ''),
         updated_by = (select auth.uid())
   where id = v_old.id
  returning * into v_new;
  perform set_config('bibliovolta.closure_notice', '', true);

  if v_old.is_open and not v_new.is_open then
    if p_notice = 'custom' then
      select * into v_res from public.create_day_announcement(v_new.id, true, true, btrim(p_subject), btrim(p_message), 'chiusura');
      v_sent := v_res.recipients;
    elsif p_notice = 'default' then
      v_sent := (select count(*)::integer from public.waitlist_entries where school_day_id = v_new.id and status = 'waiting') + v_booked;
    end if;
    perform public.log_teacher_action('giornata_chiusa', 'school_days', v_new.id::text, jsonb_build_object(
      'day', v_new.day, 'motivo', v_reason, 'prenotati', v_booked, 'in_attesa', v_waiting,
      'comunicazione', p_notice, 'destinatari', v_sent, 'oggetto', case when p_notice = 'custom' then btrim(p_subject) end));
  elsif not v_old.is_open and v_new.is_open then
    perform public.log_teacher_action('giornata_riaperta', 'school_days', v_new.id::text, jsonb_build_object('day', v_new.day, 'motivo_precedente', v_old.closure_reason));
  end if;

  if v_old.opens_at <> v_new.opens_at or v_old.closes_at <> v_new.closes_at then
    v_changes := v_changes || jsonb_build_object('orario', jsonb_build_object(
      'da', to_char(v_old.opens_at, 'HH24:MI') || '–' || to_char(v_old.closes_at, 'HH24:MI'),
      'a', to_char(v_new.opens_at, 'HH24:MI') || '–' || to_char(v_new.closes_at, 'HH24:MI')));
  end if;
  if v_old.capacity <> v_new.capacity then
    v_changes := v_changes || jsonb_build_object('capienza', jsonb_build_object('da', v_old.capacity, 'a', v_new.capacity));
  end if;
  if v_old.note is distinct from v_new.note then
    v_changes := v_changes || jsonb_build_object('nota', jsonb_build_object('da', v_old.note, 'a', v_new.note));
  end if;
  if v_changes <> '{}'::jsonb then
    perform public.log_teacher_action(case when v_changes ? 'orario' then 'orario_giornata' else 'giornata_modificata' end,
      'school_days', v_new.id::text, jsonb_build_object('day', v_new.day) || v_changes);
  end if;

  return jsonb_build_object('booked', v_booked, 'waiting', v_waiting, 'notified', v_sent, 'is_open', v_new.is_open);
end;
$$;

-- ---------------------------------------------------------------------
-- Annullamento manuale di una prenotazione da parte di un docente
-- ---------------------------------------------------------------------
create or replace function public.teacher_cancel_booking(p_booking_id uuid, p_reason text, p_notify boolean default true)
returns public.bookings
language plpgsql security definer set search_path = ''
as $$
declare
  v_reason  text := btrim(coalesce(p_reason, ''));
  v_day_id  uuid;
  v_day     public.school_days;
  v_booking public.bookings;
  v_student public.students;
begin
  perform public.require_teacher();
  if length(v_reason) < 3 then
    raise exception 'Indica il motivo dell''annullamento.' using errcode = '22023', hint = 'reason_required';
  end if;
  select school_day_id into v_day_id from public.bookings where id = p_booking_id;
  if v_day_id is null then
    raise exception 'Prenotazione non trovata.' using errcode = 'P0002', hint = 'booking_not_found';
  end if;
  select * into v_day from public.school_days where id = v_day_id for update;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.status <> 'confirmed' then
    raise exception 'La prenotazione è già stata annullata.' using errcode = 'P0001', hint = 'already_cancelled';
  end if;

  update public.bookings
     set status = 'cancelled', cancelled_at = now(), cancelled_by = (select auth.uid()), cancel_reason = v_reason
   where id = v_booking.id
  returning * into v_booking;   -- il trigger passa il posto alla lista d'attesa

  if p_notify then
    perform public.enqueue_notification('booking_cancelled', v_booking.student_id, jsonb_build_object(
      'day', v_day.day, 'reason', v_reason, 'opens_at', to_char(v_day.opens_at, 'HH24:MI'), 'closes_at', to_char(v_day.closes_at, 'HH24:MI')));
  end if;
  select * into v_student from public.students where id = v_booking.student_id;
  perform public.log_teacher_action('prenotazione_annullata', 'bookings', v_booking.id::text, jsonb_build_object(
    'day', v_day.day, 'studente', coalesce(nullif(btrim(coalesce(v_student.first_name, '') || ' ' || coalesce(v_student.last_name, '')), ''), v_student.email),
    'classe', v_student.class_name, 'motivo', v_reason, 'email', p_notify));
  return v_booking;
end;
$$;

-- ---------------------------------------------------------------------
-- Funzioni dei docenti già esistenti: ora lasciano traccia nel registro
-- ---------------------------------------------------------------------
create or replace function public.set_opening_hours(p_opens_at time, p_closes_at time)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_old   public.app_settings;
  v_count integer;
begin
  perform public.require_teacher();
  if p_opens_at is null or p_closes_at is null or p_closes_at <= p_opens_at then
    raise exception 'L''orario di chiusura deve essere successivo a quello di apertura.' using errcode = '22023', hint = 'invalid_hours';
  end if;
  select * into v_old from public.app_settings where id = 1;
  update public.app_settings
     set default_opens_at = p_opens_at, default_closes_at = p_closes_at, updated_by = (select auth.uid())
   where id = 1;
  update public.school_days
     set opens_at = p_opens_at, closes_at = p_closes_at, updated_by = (select auth.uid())
   where day > public.school_today();
  get diagnostics v_count = row_count;
  perform public.log_teacher_action('orario_generale', 'app_settings', '1', jsonb_build_object(
    'da', to_char(v_old.default_opens_at, 'HH24:MI') || '–' || to_char(v_old.default_closes_at, 'HH24:MI'),
    'a', to_char(p_opens_at, 'HH24:MI') || '–' || to_char(p_closes_at, 'HH24:MI'), 'giornate', v_count));
  return v_count;
end;
$$;

create or replace function public.set_offer_minutes(p_minutes integer)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_old integer;
begin
  perform public.require_teacher();
  if p_minutes is null or p_minutes not between 15 and 720 then
    raise exception 'Il tempo di conferma deve essere tra 15 minuti e 12 ore.' using errcode = '22023', hint = 'invalid_minutes';
  end if;
  select offer_minutes into v_old from public.app_settings where id = 1;
  update public.app_settings set offer_minutes = p_minutes, updated_by = (select auth.uid()) where id = 1;
  perform public.log_teacher_action('impostazioni', 'app_settings', '1', jsonb_build_object(
    'impostazione', 'tempo di conferma della lista d''attesa', 'da', v_old, 'a', p_minutes));
end;
$$;

create or replace function public.set_waitlist_paused(p_school_day_id uuid, p_paused boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_day date;
begin
  perform public.require_teacher();
  update public.school_days set waitlist_paused = p_paused, updated_by = (select auth.uid()) where id = p_school_day_id
  returning day into v_day;
  if v_day is null then
    raise exception 'Giornata inesistente.' using errcode = 'P0002', hint = 'day_not_found';
  end if;
  perform public.log_teacher_action(case when p_paused then 'lista_sospesa' else 'lista_riattivata' end, 'school_days', p_school_day_id::text, jsonb_build_object('day', v_day));
end;
$$;

create or replace function public.teacher_remove_waitlist_entry(p_entry_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_day_id  uuid;
  v_entry   public.waitlist_entries;
  v_student public.students;
begin
  perform public.require_teacher();
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
  select * into v_student from public.students where id = v_entry.student_id;
  perform public.log_teacher_action('lista_rimozione', 'waitlist_entries', v_entry.id::text, jsonb_build_object(
    'day', (select day from public.school_days where id = v_day_id),
    'studente', coalesce(nullif(btrim(coalesce(v_student.first_name, '') || ' ' || coalesce(v_student.last_name, '')), ''), v_student.email)));
  perform public.process_day_waitlist(v_day_id);
end;
$$;

-- ---------------------------------------------------------------------
-- Statistiche
-- ---------------------------------------------------------------------
create or replace function public.teacher_stats()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_settings public.app_settings;
  v_until    date;
  v_result   jsonb;
begin
  perform public.require_teacher();
  select * into v_settings from public.app_settings where id = 1;
  -- giornate di riferimento: aperte, dall'inizio della stagione fino a oggi
  -- o fino all'ultima giornata con prenotazioni, se successiva
  select greatest(public.school_today(), coalesce(max(d.day), public.school_today())) into v_until
    from public.school_days d join public.bookings b on b.school_day_id = d.id and b.status = 'confirmed';

  with per_day as (
    select d.id, d.day, d.capacity,
           (select count(*) from public.bookings b where b.school_day_id = d.id and b.status = 'confirmed')::integer as n
      from public.school_days d
     where d.is_open and d.day between v_settings.season_start and least(v_until, v_settings.season_end)
  ),
  conf as (
    select b.*, s.class_name from public.bookings b join public.students s on s.id = b.student_id where b.status = 'confirmed'
  )
  select jsonb_build_object(
    'total_bookings', (select count(*) from conf),
    'cancellations', (select count(*) from public.bookings where status = 'cancelled'),
    'unique_students', (select count(distinct student_id) from conf),
    'registered_students', (select count(*) from public.students where registered_at is not null and is_active),
    'reference_days', (select count(*) from per_day),
    'avg_daily', coalesce((select round(avg(n)::numeric, 1) from per_day), 0),
    'avg_occupancy', coalesce((select round(avg(n * 100.0 / capacity)::numeric, 1) from per_day), 0),
    'waiting', (select count(*) from public.waitlist_entries w join public.school_days d on d.id = w.school_day_id
                 where w.status in ('waiting', 'offered') and d.day >= public.school_today()),
    'full_days', (select count(*) from per_day where n >= capacity),
    'top_days', coalesce((select jsonb_agg(t order by t.n desc, t.day) from (
                   select day, n, capacity from per_day where n > 0 order by n desc, day limit 5) t), '[]'::jsonb),
    'classes', coalesce((select jsonb_agg(c order by c.n desc, c.class_name) from (
                   select coalesce(class_name, '—') as class_name, count(*)::integer as n from conf group by 1 order by 2 desc, 1 limit 8) c), '[]'::jsonb),
    'weekdays', coalesce((select jsonb_agg(w order by w.dow) from (
                   select extract(isodow from day)::integer as dow, round(avg(n * 100.0 / capacity)::numeric, 0) as occupancy, round(avg(n)::numeric, 1) as avg_n
                     from per_day group by 1) w), '[]'::jsonb),
    'weeks', coalesce((select jsonb_agg(k order by k.week_start) from (
                   select date_trunc('week', day)::date as week_start, sum(n)::integer as bookings,
                          round(avg(n * 100.0 / capacity)::numeric, 0) as occupancy
                     from per_day group by 1 order by 1 desc limit 10) k), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------
-- Privilegi
-- ---------------------------------------------------------------------
revoke execute on function
  public.log_teacher_action(text, text, text, jsonb),
  public.create_day_announcement(uuid, boolean, boolean, text, text, text),
  public.complete_notification(bigint, boolean, text, text, boolean),
  public.after_school_day_change()
  from public, anon, authenticated;

revoke execute on function
  public.require_teacher(), public.announcement_recipients_count(uuid, boolean, boolean),
  public.send_announcement(uuid, boolean, boolean, text, text, text), public.retry_announcement(uuid),
  public.teacher_update_day(uuid, boolean, integer, time, time, text, text, text, text, text),
  public.teacher_cancel_booking(uuid, text, boolean), public.teacher_stats(),
  public.set_opening_hours(time, time), public.set_offer_minutes(integer),
  public.set_waitlist_paused(uuid, boolean), public.teacher_remove_waitlist_entry(uuid)
  from public, anon;
grant execute on function
  public.require_teacher(), public.announcement_recipients_count(uuid, boolean, boolean),
  public.send_announcement(uuid, boolean, boolean, text, text, text), public.retry_announcement(uuid),
  public.teacher_update_day(uuid, boolean, integer, time, time, text, text, text, text, text),
  public.teacher_cancel_booking(uuid, text, boolean), public.teacher_stats(),
  public.set_opening_hours(time, time), public.set_offer_minutes(integer),
  public.set_waitlist_paused(uuid, boolean), public.teacher_remove_waitlist_entry(uuid)
  to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.complete_notification(bigint, boolean, text, text, boolean) to service_role;
  end if;
end;
$$;
