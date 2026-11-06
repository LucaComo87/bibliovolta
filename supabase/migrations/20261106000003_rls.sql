-- =====================================================================
-- BIBLIOVOLTA · Migrazione 3 · Autorizzazioni (Row Level Security)
-- =====================================================================
-- Principi:
--   * RLS attiva su TUTTE le tabelle: senza una policy esplicita non si
--     legge e non si scrive nulla.
--   * ruolo "anon" (utente non autenticato): nessun accesso ai dati.
--   * studente: vede solo il proprio profilo e le proprie righe.
--     Non scrive direttamente su prenotazioni/liste/proposte: lo farà
--     tramite funzioni RPC controllate (Fasi 4 e 7).
--   * docente attivo: gestione completa; i docenti "admin" gestiscono
--     anche gli altri docenti e le impostazioni generali.
--   * il service role (solo lato server) ignora la RLS per natura.
-- =====================================================================

alter table public.app_settings            enable row level security;
alter table public.students                enable row level security;
alter table public.teachers                enable row level security;
alter table public.school_days             enable row level security;
alter table public.bookings                enable row level security;
alter table public.waitlist_entries        enable row level security;
alter table public.seat_offers             enable row level security;
alter table public.announcements           enable row level security;
alter table public.announcement_deliveries enable row level security;
alter table public.audit_log               enable row level security;

-- Nessun privilegio per gli utenti non autenticati
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon, public;

-- Privilegi di base per gli utenti autenticati (filtrati poi dalla RLS)
grant select, insert, update, delete on
  public.students, public.teachers, public.school_days, public.bookings,
  public.waitlist_entries, public.seat_offers, public.announcements
  to authenticated;
grant select, update on public.app_settings to authenticated;
grant select, insert, delete on public.announcement_deliveries to authenticated;
grant update (read_at) on public.announcement_deliveries to authenticated;
grant select on public.audit_log to authenticated;
revoke insert, update, delete on public.audit_log from authenticated;

grant execute on function
  public.is_teacher(), public.is_admin_teacher(), public.is_student(),
  public.current_app_role(), public.get_day_availability(date, date)
  to authenticated;

-- ---------------------------------------------------------------------
-- app_settings
-- ---------------------------------------------------------------------
create policy "settings: lettura utenti autenticati"
  on public.app_settings for select to authenticated
  using (true);

create policy "settings: modifica docenti admin"
  on public.app_settings for update to authenticated
  using ((select public.is_admin_teacher()))
  with check ((select public.is_admin_teacher()));

-- ---------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------
create policy "students: lettura del proprio profilo o docente"
  on public.students for select to authenticated
  using (id = (select auth.uid()) or (select public.is_teacher()));

create policy "students: inserimento solo docenti"
  on public.students for insert to authenticated
  with check ((select public.is_teacher()));

create policy "students: modifica solo docenti"
  on public.students for update to authenticated
  using ((select public.is_teacher()))
  with check ((select public.is_teacher()));

create policy "students: eliminazione solo docenti admin"
  on public.students for delete to authenticated
  using ((select public.is_admin_teacher()));

-- ---------------------------------------------------------------------
-- teachers
-- ---------------------------------------------------------------------
create policy "teachers: lettura tra docenti"
  on public.teachers for select to authenticated
  using ((select public.is_teacher()));

create policy "teachers: scrittura solo docenti admin"
  on public.teachers for all to authenticated
  using ((select public.is_admin_teacher()))
  with check ((select public.is_admin_teacher()));

-- ---------------------------------------------------------------------
-- school_days (il calendario è visibile a tutti gli utenti autenticati)
-- ---------------------------------------------------------------------
create policy "school_days: lettura utenti autenticati"
  on public.school_days for select to authenticated
  using (true);

create policy "school_days: gestione docenti"
  on public.school_days for all to authenticated
  using ((select public.is_teacher()))
  with check ((select public.is_teacher()));

-- ---------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------
create policy "bookings: lettura proprie o docente"
  on public.bookings for select to authenticated
  using (student_id = (select auth.uid()) or (select public.is_teacher()));

create policy "bookings: gestione docenti"
  on public.bookings for all to authenticated
  using ((select public.is_teacher()))
  with check ((select public.is_teacher()));

-- ---------------------------------------------------------------------
-- waitlist_entries
-- ---------------------------------------------------------------------
create policy "waitlist: lettura proprie o docente"
  on public.waitlist_entries for select to authenticated
  using (student_id = (select auth.uid()) or (select public.is_teacher()));

create policy "waitlist: gestione docenti"
  on public.waitlist_entries for all to authenticated
  using ((select public.is_teacher()))
  with check ((select public.is_teacher()));

-- ---------------------------------------------------------------------
-- seat_offers
-- ---------------------------------------------------------------------
create policy "offers: lettura proprie o docente"
  on public.seat_offers for select to authenticated
  using (student_id = (select auth.uid()) or (select public.is_teacher()));

create policy "offers: gestione docenti"
  on public.seat_offers for all to authenticated
  using ((select public.is_teacher()))
  with check ((select public.is_teacher()));

-- ---------------------------------------------------------------------
-- announcements: lo studente vede solo le comunicazioni pubblicate
-- di cui è destinatario.
-- ---------------------------------------------------------------------
create policy "announcements: lettura destinatari o docente"
  on public.announcements for select to authenticated
  using (
    (select public.is_teacher())
    or (
      published_at is not null
      and (
        audience = 'all_students'
        or student_id = (select auth.uid())
        or exists (
          select 1 from public.announcement_deliveries d
           where d.announcement_id = announcements.id
             and d.student_id = (select auth.uid())
        )
      )
    )
  );

create policy "announcements: gestione docenti"
  on public.announcements for all to authenticated
  using ((select public.is_teacher()))
  with check ((select public.is_teacher()));

-- ---------------------------------------------------------------------
-- announcement_deliveries
-- ---------------------------------------------------------------------
create policy "deliveries: lettura proprie o docente"
  on public.announcement_deliveries for select to authenticated
  using (student_id = (select auth.uid()) or (select public.is_teacher()));

-- lo studente può solo segnare come letta (colonna read_at, vedi GRANT)
create policy "deliveries: segna come letta"
  on public.announcement_deliveries for update to authenticated
  using (student_id = (select auth.uid()) or (select public.is_teacher()))
  with check (student_id = (select auth.uid()) or (select public.is_teacher()));

create policy "deliveries: inserimento docenti"
  on public.announcement_deliveries for insert to authenticated
  with check ((select public.is_teacher()));

create policy "deliveries: eliminazione docenti"
  on public.announcement_deliveries for delete to authenticated
  using ((select public.is_teacher()));

-- ---------------------------------------------------------------------
-- audit_log: sola lettura per i docenti; scritto solo dai trigger
-- ---------------------------------------------------------------------
create policy "audit: lettura docenti"
  on public.audit_log for select to authenticated
  using ((select public.is_teacher()));
