-- =====================================================================
-- BIBLIOVOLTA · Migrazione 1 · Schema delle tabelle
-- Liceo A. Volta di Como — prenotazione dell'aula studio
-- =====================================================================
-- Convenzioni:
--   * identificativi univoci UUID (gen_random_uuid) per tutte le entità;
--     bigint identity solo per il registro operazioni (alto volume).
--   * studenti e docenti hanno come chiave primaria l'id di auth.users
--     (relazione 1:1 con l'account di autenticazione Supabase).
--   * nessuna riga viene cancellata fisicamente nelle tabelle operative:
--     prenotazioni, liste d'attesa e proposte cambiano "status".
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tipi enumerati
-- ---------------------------------------------------------------------
create type public.user_role as enum ('student', 'teacher');

create type public.booking_status as enum ('confirmed', 'cancelled');

create type public.booking_source as enum (
  'student',        -- prenotazione fatta dallo studente
  'teacher',        -- inserita da un docente
  'waitlist_offer'  -- nata dall'accettazione di una proposta di posto
);

create type public.waitlist_status as enum (
  'waiting',    -- in coda
  'offered',    -- ha ricevuto una proposta di posto
  'assigned',   -- ha ottenuto il posto
  'expired',    -- giornata passata o proposta scaduta
  'withdrawn'   -- uscito dalla lista
);

create type public.offer_status as enum (
  'pending',   -- in attesa di risposta
  'accepted',  -- accettata: ha generato una prenotazione
  'declined',  -- rifiutata dallo studente
  'expired',   -- scaduta senza risposta
  'revoked'    -- annullata da un docente o dal sistema
);

create type public.announcement_audience as enum (
  'all_students',   -- tutti gli studenti registrati
  'day_bookings',   -- chi ha prenotato una certa giornata
  'single_student'  -- un singolo studente
);

create type public.delivery_status as enum ('pending', 'sent', 'failed', 'skipped');

-- ---------------------------------------------------------------------
-- Impostazioni generali (una sola riga)
-- ---------------------------------------------------------------------
create table public.app_settings (
  id                      smallint primary key default 1 check (id = 1),
  season_start            date        not null default '2026-11-16',
  season_end              date        not null default '2027-06-04',
  default_capacity        integer     not null default 50 check (default_capacity between 1 and 500),
  default_opens_at        time        not null default '14:15',
  default_closes_at       time        not null default '16:30',
  cancellation_hours      integer     not null default 24 check (cancellation_hours between 0 and 168),
  student_email_domain    text        not null default 'stud.liceovoltacomo.edu.it',
  school_timezone         text        not null default 'Europe/Rome',
  updated_at              timestamptz not null default now(),
  updated_by              uuid,
  constraint app_settings_season_ck check (season_end >= season_start),
  constraint app_settings_hours_ck  check (default_closes_at > default_opens_at)
);
comment on table public.app_settings is 'Parametri globali della piattaforma (riga unica, id = 1).';

insert into public.app_settings (id) values (1);

-- ---------------------------------------------------------------------
-- Studenti (account Google @stud.liceovoltacomo.edu.it)
-- ---------------------------------------------------------------------
create table public.students (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null unique check (email = lower(email)),
  full_name   text not null default '',
  first_name  text,
  last_name   text,
  class_name  text,               -- es. "4B": compilata in una fase successiva
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.students is 'Profili studente, 1:1 con auth.users. Creati automaticamente al primo accesso Google.';

-- ---------------------------------------------------------------------
-- Docenti (account email + password creati dall'amministrazione)
-- ---------------------------------------------------------------------
create table public.teachers (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null unique check (email = lower(email)),
  full_name   text not null default '',
  is_admin    boolean not null default false, -- può gestire gli altri docenti e le impostazioni
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.teachers is 'Profili docente, 1:1 con auth.users. Creati solo tramite script amministrativo (service role).';

alter table public.app_settings
  add constraint app_settings_updated_by_fk
  foreign key (updated_by) references public.teachers (id) on delete set null;

-- ---------------------------------------------------------------------
-- Giornate prenotabili
-- ---------------------------------------------------------------------
create table public.school_days (
  id              uuid primary key default gen_random_uuid(),
  day             date not null unique,
  is_open         boolean not null default true,
  capacity        integer not null default 50 check (capacity between 1 and 500),
  opens_at        time not null default '14:15',
  closes_at       time not null default '16:30',
  closure_reason  text,          -- es. "Festa dell'Immacolata", "Sospensione attività"
  note            text,          -- nota visibile agli studenti
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.teachers (id) on delete set null,
  constraint school_days_weekday_ck check (extract(isodow from day) between 1 and 5),
  constraint school_days_hours_ck   check (closes_at > opens_at),
  constraint school_days_closed_reason_ck check (is_open or closure_reason is not null)
);
comment on table public.school_days is 'Una riga per ogni giorno feriale della stagione. I docenti possono chiuderle o cambiarne la capienza.';

-- ---------------------------------------------------------------------
-- Prenotazioni
-- ---------------------------------------------------------------------
create table public.bookings (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.students (id) on delete cascade,
  school_day_id   uuid not null references public.school_days (id) on delete restrict,
  status          public.booking_status not null default 'confirmed',
  source          public.booking_source not null default 'student',
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null,
  cancelled_at    timestamptz,
  cancelled_by    uuid references auth.users (id) on delete set null,
  cancel_reason   text,
  updated_at      timestamptz not null default now(),
  constraint bookings_cancel_ck check (
    (status = 'cancelled' and cancelled_at is not null) or
    (status = 'confirmed' and cancelled_at is null)
  )
);
-- Uno studente può avere al massimo UNA prenotazione confermata per giornata.
create unique index bookings_one_active_per_day
  on public.bookings (student_id, school_day_id) where status = 'confirmed';
create index bookings_day_confirmed_idx on public.bookings (school_day_id) where status = 'confirmed';
create index bookings_student_idx on public.bookings (student_id, created_at desc);

-- ---------------------------------------------------------------------
-- Liste d'attesa
-- ---------------------------------------------------------------------
create table public.waitlist_entries (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.students (id) on delete cascade,
  school_day_id   uuid not null references public.school_days (id) on delete restrict,
  status          public.waitlist_status not null default 'waiting',
  joined_at       timestamptz not null default now(),  -- determina l'ordine della coda
  updated_at      timestamptz not null default now()
);
create unique index waitlist_one_active_per_day
  on public.waitlist_entries (student_id, school_day_id) where status in ('waiting', 'offered');
create index waitlist_queue_idx on public.waitlist_entries (school_day_id, joined_at) where status = 'waiting';

-- ---------------------------------------------------------------------
-- Proposte di assegnazione dei posti (posto liberato → primo in coda)
-- ---------------------------------------------------------------------
create table public.seat_offers (
  id                  uuid primary key default gen_random_uuid(),
  school_day_id       uuid not null references public.school_days (id) on delete restrict,
  student_id          uuid not null references public.students (id) on delete cascade,
  waitlist_entry_id   uuid not null references public.waitlist_entries (id) on delete cascade,
  booking_id          uuid references public.bookings (id) on delete set null, -- valorizzato se accettata
  status              public.offer_status not null default 'pending',
  offered_at          timestamptz not null default now(),
  expires_at          timestamptz not null,
  responded_at        timestamptz,
  created_by          uuid references auth.users (id) on delete set null, -- null = sistema
  updated_at          timestamptz not null default now(),
  constraint seat_offers_expiry_ck check (expires_at > offered_at),
  constraint seat_offers_booking_ck check (status <> 'accepted' or booking_id is not null)
);
create unique index seat_offers_one_pending_per_entry
  on public.seat_offers (waitlist_entry_id) where status = 'pending';
create index seat_offers_student_idx on public.seat_offers (student_id, offered_at desc);
create index seat_offers_pending_expiry_idx on public.seat_offers (expires_at) where status = 'pending';

-- ---------------------------------------------------------------------
-- Comunicazioni dei docenti
-- ---------------------------------------------------------------------
create table public.announcements (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid references public.teachers (id) on delete set null,
  title           text not null check (length(title) between 1 and 200),
  body            text not null check (length(body) between 1 and 10000),
  audience        public.announcement_audience not null,
  school_day_id   uuid references public.school_days (id) on delete set null,
  student_id      uuid references public.students (id) on delete cascade,
  send_email      boolean not null default true,
  published_at    timestamptz,     -- null = bozza
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint announcements_target_ck check (
    (audience = 'all_students'   and school_day_id is null     and student_id is null) or
    (audience = 'day_bookings'   and school_day_id is not null and student_id is null) or
    (audience = 'single_student' and student_id is not null)
  )
);
create index announcements_published_idx on public.announcements (published_at desc);

-- Destinatari effettivi di ogni comunicazione (+ stato dell'email Resend)
create table public.announcement_deliveries (
  id                  uuid primary key default gen_random_uuid(),
  announcement_id     uuid not null references public.announcements (id) on delete cascade,
  student_id          uuid not null references public.students (id) on delete cascade,
  email_status        public.delivery_status not null default 'pending',
  email_provider_id   text,   -- id restituito da Resend
  email_error         text,
  sent_at             timestamptz,
  read_at             timestamptz,
  created_at          timestamptz not null default now(),
  unique (announcement_id, student_id)
);
create index announcement_deliveries_student_idx on public.announcement_deliveries (student_id, created_at desc);

-- ---------------------------------------------------------------------
-- Registro delle operazioni (solo inserimento, alimentato da trigger)
-- ---------------------------------------------------------------------
create table public.audit_log (
  id            bigint generated always as identity primary key,
  occurred_at   timestamptz not null default now(),
  actor_id      uuid,                    -- auth.uid() di chi ha agito; null = sistema/service role
  actor_role    public.user_role,
  action        text not null,           -- es. "bookings.insert", "school_days.update"
  entity_type   text not null,
  entity_id     text,
  details       jsonb not null default '{}'::jsonb
);
create index audit_log_occurred_idx on public.audit_log (occurred_at desc);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);
create index audit_log_actor_idx on public.audit_log (actor_id, occurred_at desc);
comment on table public.audit_log is 'Registro immutabile delle operazioni. Leggibile solo dai docenti.';
