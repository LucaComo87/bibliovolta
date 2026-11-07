-- =====================================================================
-- BIBLIOVOLTA · Migrazione 10 · Docenti di turno (sorveglianza dell'aula)
--
-- Per ogni giornata uno o più "docenti di turno", responsabili della
-- sorveglianza della biblioteca in quel pomeriggio.
--  * ogni docente collegato può prendere o lasciare il proprio turno;
--  * un docente amministratore può assegnare il turno a qualsiasi docente
--    scrivendone nome e cognome (anche se non ha un account BIBLIOVOLTA)
--    e togliere qualsiasi turno;
--  * tutte le operazioni finiscono nel registro dei docenti;
--  * solo i docenti vedono i turni.
-- =====================================================================

create table public.supervision_shifts (
  id             uuid primary key default gen_random_uuid(),
  school_day_id  uuid not null references public.school_days (id) on delete cascade,
  teacher_id     uuid references public.teachers (id) on delete set null,
  teacher_name   text not null check (char_length(btrim(teacher_name)) between 3 and 120),
  assigned_by    uuid references public.teachers (id) on delete set null,
  created_at     timestamptz not null default now()
);
comment on table public.supervision_shifts is 'Docenti di turno: responsabili della sorveglianza dell''aula studio in una giornata.';

create unique index supervision_shifts_teacher_uq on public.supervision_shifts (school_day_id, teacher_id) where teacher_id is not null;
create unique index supervision_shifts_name_uq on public.supervision_shifts (school_day_id, lower(btrim(teacher_name)));
create index supervision_shifts_day_idx on public.supervision_shifts (school_day_id);

alter table public.supervision_shifts enable row level security;
create policy "supervision_shifts: lettura docenti" on public.supervision_shifts
  for select to authenticated using ((select public.is_teacher()));
-- nessuna scrittura diretta: solo tramite le funzioni qui sotto
revoke insert, update, delete on public.supervision_shifts from anon, authenticated;
revoke all on public.supervision_shifts from anon;

-- massimo di docenti di turno nella stessa giornata
alter table public.app_settings
  add column max_shifts_per_day integer not null default 3 check (max_shifts_per_day between 1 and 10);

-- ---------------------------------------------------------------------
-- Controlli comuni
-- ---------------------------------------------------------------------
create or replace function public.shift_day_check(p_school_day_id uuid)
returns public.school_days
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_day public.school_days;
  v_max integer;
begin
  select * into v_day from public.school_days where id = p_school_day_id;
  if not found then
    raise exception 'Giornata inesistente.' using errcode = 'P0002', hint = 'day_not_found';
  end if;
  if v_day.day < public.school_today() then
    raise exception 'La giornata è già passata.' using errcode = '22023', hint = 'day_past';
  end if;
  select max_shifts_per_day into v_max from public.app_settings where id = 1;
  if (select count(*) from public.supervision_shifts where school_day_id = p_school_day_id) >= v_max then
    raise exception 'Per questa giornata ci sono già % docenti di turno.', v_max using errcode = '23514', hint = 'shift_full';
  end if;
  return v_day;
end;
$$;

-- ---------------------------------------------------------------------
-- Il docente collegato prende il turno
-- ---------------------------------------------------------------------
create or replace function public.take_shift(p_school_day_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_day  public.school_days;
  v_name text;
  v_id   uuid;
begin
  perform public.require_teacher();
  -- un solo turno alla volta per giornata: blocco sulla riga della giornata
  perform 1 from public.school_days where id = p_school_day_id for update;
  if exists (select 1 from public.supervision_shifts where school_day_id = p_school_day_id and teacher_id = v_uid) then
    raise exception 'Sei già di turno in questa giornata.' using errcode = '23505', hint = 'already_on_shift';
  end if;
  v_day := public.shift_day_check(p_school_day_id);
  select coalesce(nullif(btrim(full_name), ''), email) into v_name from public.teachers where id = v_uid;
  -- se l'amministratore aveva già scritto lo stesso nome, il turno diventa del docente
  update public.supervision_shifts
     set teacher_id = v_uid
   where school_day_id = p_school_day_id and teacher_id is null and lower(btrim(teacher_name)) = lower(btrim(v_name))
  returning id into v_id;
  if v_id is null then
    insert into public.supervision_shifts (school_day_id, teacher_id, teacher_name, assigned_by)
    values (p_school_day_id, v_uid, v_name, v_uid)
    returning id into v_id;
  end if;
  perform public.log_teacher_action('turno_preso', 'supervision_shifts', v_id::text,
    jsonb_build_object('day', v_day.day, 'docente', v_name));
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- L'amministratore assegna il turno a un docente indicato per nome
-- ---------------------------------------------------------------------
create or replace function public.assign_shift(p_school_day_id uuid, p_teacher_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_name    text := regexp_replace(btrim(coalesce(p_teacher_name, '')), '\s+', ' ', 'g');
  v_day     public.school_days;
  v_teacher uuid;
  v_id      uuid;
begin
  perform public.require_teacher();
  if not public.is_admin_teacher() then
    raise exception 'Solo un amministratore può assegnare il turno ad altri docenti.' using errcode = '42501', hint = 'not_admin';
  end if;
  if char_length(v_name) < 3 or char_length(v_name) > 120 then
    raise exception 'Scrivi nome e cognome del docente.' using errcode = '22023', hint = 'invalid_name';
  end if;
  perform 1 from public.school_days where id = p_school_day_id for update;
  if exists (select 1 from public.supervision_shifts where school_day_id = p_school_day_id and lower(btrim(teacher_name)) = lower(v_name)) then
    raise exception '% è già di turno in questa giornata.', v_name using errcode = '23505', hint = 'already_on_shift';
  end if;
  v_day := public.shift_day_check(p_school_day_id);
  -- collegamento all'account, se il nome corrisponde a un solo docente registrato
  select id into v_teacher from public.teachers
   where is_active and lower(btrim(full_name)) = lower(v_name)
   limit 2;
  if (select count(*) from public.teachers where is_active and lower(btrim(full_name)) = lower(v_name)) <> 1 then
    v_teacher := null;
  elsif exists (select 1 from public.supervision_shifts where school_day_id = p_school_day_id and teacher_id = v_teacher) then
    raise exception '% è già di turno in questa giornata.', v_name using errcode = '23505', hint = 'already_on_shift';
  end if;
  insert into public.supervision_shifts (school_day_id, teacher_id, teacher_name, assigned_by)
  values (p_school_day_id, v_teacher, v_name, (select auth.uid()))
  returning id into v_id;
  perform public.log_teacher_action('turno_assegnato', 'supervision_shifts', v_id::text,
    jsonb_build_object('day', v_day.day, 'docente', v_name));
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Togliere un turno: il proprio, oppure qualsiasi se amministratore
-- ---------------------------------------------------------------------
create or replace function public.remove_shift(p_shift_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_shift public.supervision_shifts;
  v_day   date;
begin
  perform public.require_teacher();
  select * into v_shift from public.supervision_shifts where id = p_shift_id for update;
  if not found then
    raise exception 'Turno inesistente.' using errcode = 'P0002', hint = 'shift_not_found';
  end if;
  if v_shift.teacher_id is distinct from (select auth.uid()) and not public.is_admin_teacher() then
    raise exception 'Puoi togliere solo il tuo turno.' using errcode = '42501', hint = 'not_own_shift';
  end if;
  select day into v_day from public.school_days where id = v_shift.school_day_id;
  if v_day < public.school_today() then
    raise exception 'La giornata è già passata.' using errcode = '22023', hint = 'day_past';
  end if;
  delete from public.supervision_shifts where id = p_shift_id;
  perform public.log_teacher_action('turno_rimosso', 'supervision_shifts', p_shift_id::text,
    jsonb_build_object('day', v_day, 'docente', v_shift.teacher_name,
                       'proprio', v_shift.teacher_id is not distinct from (select auth.uid())));
end;
$$;

-- ---------------------------------------------------------------------
-- Privilegi
-- ---------------------------------------------------------------------
revoke execute on function
  public.shift_day_check(uuid), public.take_shift(uuid), public.assign_shift(uuid, text), public.remove_shift(uuid)
  from public, anon;
revoke execute on function public.shift_day_check(uuid) from authenticated;
grant execute on function public.take_shift(uuid), public.assign_shift(uuid, text), public.remove_shift(uuid) to authenticated;
grant select on public.supervision_shifts to authenticated;
