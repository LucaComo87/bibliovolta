-- =====================================================================
-- BIBLIOVOLTA · Migrazione 4 · Generazione del calendario 2026/27
-- =====================================================================
-- Crea una giornata prenotabile per ogni giorno da lunedì a venerdì
-- tra season_start (lun 16/11/2026) e season_end (ven 04/06/2027),
-- con capienza e orari predefiniti (50 posti, 14:15–16:30).
-- Festività e sospensioni NON sono inserite qui: le configurano i
-- docenti (oppure si può applicare supabase/seed/festivita_nazionali.sql).
-- La funzione è riutilizzabile per le stagioni successive.
-- =====================================================================

create or replace function public.generate_school_days(p_from date, p_to date)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_settings public.app_settings;
  v_count    integer;
begin
  if not (public.is_teacher() or (select auth.uid()) is null) then
    raise exception 'BIBLIOVOLTA: operazione riservata ai docenti.' using errcode = '42501';
  end if;

  select * into v_settings from public.app_settings where id = 1;

  insert into public.school_days (day, capacity, opens_at, closes_at)
  select g::date, v_settings.default_capacity, v_settings.default_opens_at, v_settings.default_closes_at
    from generate_series(p_from, p_to, interval '1 day') as g
   where extract(isodow from g) between 1 and 5
  on conflict (day) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.generate_school_days(date, date) from public, anon;
grant execute on function public.generate_school_days(date, date) to authenticated;

select public.generate_school_days(s.season_start, s.season_end)
  from public.app_settings s where s.id = 1;
