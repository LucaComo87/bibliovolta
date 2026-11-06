-- =====================================================================
-- BIBLIOVOLTA · Migrazione 9 · Privacy (GDPR), conservazione dei dati,
-- rafforzamento della sicurezza (Fase 7)
--
--  * minimizzazione: il registro tecnico non salva più nomi, email e hash
--    dei link; i metadati dell'account Google non conservano la foto;
--  * tempi di conservazione definiti e cancellazione automatica ogni notte
--    (purge_expired_data, Supabase Cron);
--  * diritto di accesso: lo studente scarica i propri dati (export_my_data);
--  * diritto alla cancellazione: erase_student (solo service role, su
--    richiesta motivata alla scuola);
--  * inviti docenti validi 30 minuti: un'email invitata non resta "aperta".
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tempi di conservazione (modificabili dall'amministratore via SQL)
-- ---------------------------------------------------------------------
alter table public.app_settings
  add column retention_months integer not null default 12 check (retention_months between 3 and 60),
  add column audit_retention_months integer not null default 24 check (audit_retention_months between 6 and 120),
  add column inactive_student_months integer not null default 12 check (inactive_student_months between 6 and 60),
  add column technical_retention_days integer not null default 30 check (technical_retention_days between 7 and 365);
comment on column public.app_settings.retention_months is 'Prenotazioni, liste d''attesa, proposte e comunicazioni: mesi di conservazione dopo la giornata.';
comment on column public.app_settings.audit_retention_months is 'Registro delle operazioni: mesi di conservazione.';
comment on column public.app_settings.inactive_student_months is 'Profilo studente senza attività: mesi prima della cancellazione automatica.';
comment on column public.app_settings.technical_retention_days is 'Coda email e tentativi di accesso: giorni di conservazione.';

-- ---------------------------------------------------------------------
-- Registro tecnico senza dati personali in chiaro
-- ---------------------------------------------------------------------
create or replace function public.audit_redact(p_row jsonb)
returns jsonb
language sql immutable set search_path = ''
as $$
  select p_row - 'email' - 'full_name' - 'first_name' - 'last_name' - 'token_hash' - 'to_email';
$$;

create or replace function public.audit_row_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_old  jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_new  jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  v_diff jsonb := '{}'::jsonb;
  v_key  text;
  v_private constant text[] := array['email', 'full_name', 'first_name', 'last_name', 'token_hash', 'to_email'];
begin
  -- la cancellazione per scadenza dei tempi di conservazione non lascia tracce personali
  if current_setting('bibliovolta.purge', true) = 'on' then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' then
    for v_key in select jsonb_object_keys(v_new) loop
      if v_key <> 'updated_at' and (v_new -> v_key) is distinct from (v_old -> v_key) then
        v_diff := v_diff || jsonb_build_object(v_key,
          case when v_key = any (v_private) then jsonb_build_object('modificato', true)
               else jsonb_build_object('da', v_old -> v_key, 'a', v_new -> v_key) end);
      end if;
    end loop;
    if v_diff = '{}'::jsonb then
      return new;
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
      when 'INSERT' then jsonb_build_object('nuovo', public.audit_redact(v_new))
      when 'UPDATE' then jsonb_build_object('modifiche', v_diff)
      else jsonb_build_object('eliminato', jsonb_build_object('id', v_old -> 'id'))
    end
  );
  return coalesce(new, old);
end;
$$;

-- righe già presenti (installazioni esistenti): stessi criteri
update public.audit_log
   set details = case
     when details ? 'nuovo' then jsonb_build_object('nuovo', public.audit_redact(details -> 'nuovo'))
     when details ? 'eliminato' then jsonb_build_object('eliminato', jsonb_build_object('id', details -> 'eliminato' -> 'id'))
     else details - 'email' end
 where action not like 'docente.%';

-- ---------------------------------------------------------------------
-- Account Google: si conservano solo i dati necessari (niente foto)
-- ---------------------------------------------------------------------
create or replace function public.minimize_auth_metadata()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.raw_user_meta_data is not null then
    new.raw_user_meta_data := new.raw_user_meta_data - 'picture' - 'avatar_url' - 'phone' - 'locale';
    if new.raw_user_meta_data ? 'custom_claims' then
      new.raw_user_meta_data := jsonb_set(new.raw_user_meta_data, '{custom_claims}',
        (new.raw_user_meta_data -> 'custom_claims') - 'picture' - 'avatar_url' - 'locale');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists minimize_auth_metadata on auth.users;
create trigger minimize_auth_metadata
  before insert or update of raw_user_meta_data on auth.users
  for each row execute function public.minimize_auth_metadata();

update auth.users set raw_user_meta_data = raw_user_meta_data where raw_user_meta_data ?| array['picture', 'avatar_url'];

-- anche nei dati dell'identità collegata (tabella di Supabase Auth)
create or replace function public.minimize_identity_data()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.identity_data is not null then
    new.identity_data := new.identity_data - 'picture' - 'avatar_url' - 'phone' - 'locale';
    if new.identity_data ? 'custom_claims' then
      new.identity_data := jsonb_set(new.identity_data, '{custom_claims}',
        (new.identity_data -> 'custom_claims') - 'picture' - 'avatar_url' - 'locale');
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.minimize_identity_data() from public, anon, authenticated;

do $$
begin
  if to_regclass('auth.identities') is not null then
    execute 'drop trigger if exists minimize_identity_data on auth.identities';
    execute 'create trigger minimize_identity_data before insert or update of identity_data on auth.identities
             for each row execute function public.minimize_identity_data()';
    execute $q$update auth.identities set identity_data = identity_data where identity_data ?| array['picture', 'avatar_url']$q$;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Inviti docenti: validi 30 minuti (lo script teacher:create li usa subito)
-- ---------------------------------------------------------------------
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
  -- Account con email e password: SOLO docenti pre-autorizzati da meno di 30 minuti
  if v_provider <> 'google' then
    select * into v_invite from public.teacher_invitations
     where email = v_email and created_at > now() - interval '30 minutes';
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
    left(nullif(trim(coalesce(v_meta->>'given_name', v_meta->'custom_claims'->>'given_name')), ''), 60),
    left(nullif(trim(coalesce(v_meta->>'family_name', v_meta->'custom_claims'->>'family_name')), ''), 60)
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Diritto di accesso: i dati di chi chiama, in un unico documento
-- ---------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_student public.students;
begin
  select * into v_student from public.students where id = v_uid;
  if not found then
    raise exception 'Funzione riservata agli studenti.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'generato_il', now(),
    'titolare', 'Liceo A. Volta di Como',
    'profilo', jsonb_build_object(
      'email', v_student.email, 'nome', v_student.first_name, 'cognome', v_student.last_name,
      'classe', v_student.class_name, 'account_creato_il', v_student.created_at, 'registrazione_completata_il', v_student.registered_at),
    'prenotazioni', coalesce((
      select jsonb_agg(jsonb_build_object('giornata', d.day, 'stato', b.status, 'origine', b.source,
               'prenotata_il', b.created_at, 'annullata_il', b.cancelled_at, 'motivo_annullamento', b.cancel_reason) order by d.day)
        from public.bookings b join public.school_days d on d.id = b.school_day_id where b.student_id = v_uid), '[]'::jsonb),
    'liste_attesa', coalesce((
      select jsonb_agg(jsonb_build_object('giornata', d.day, 'stato', w.status, 'iscritto_il', w.joined_at) order by d.day)
        from public.waitlist_entries w join public.school_days d on d.id = w.school_day_id where w.student_id = v_uid), '[]'::jsonb),
    'proposte_di_posto', coalesce((
      select jsonb_agg(jsonb_build_object('giornata', d.day, 'stato', o.status, 'inviata_il', o.offered_at,
               'scadenza', o.expires_at, 'risposta_il', o.responded_at) order by o.offered_at)
        from public.seat_offers o join public.school_days d on d.id = o.school_day_id where o.student_id = v_uid), '[]'::jsonb),
    'comunicazioni_ricevute', coalesce((
      select jsonb_agg(jsonb_build_object('oggetto', a.title, 'testo', a.body, 'pubblicata_il', a.published_at,
               'email', ad.email_status, 'inviata_il', ad.sent_at) order by a.published_at)
        from public.announcement_deliveries ad join public.announcements a on a.id = ad.announcement_id
       where ad.student_id = v_uid), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Diritto alla cancellazione (solo service role: script student:erase)
-- ---------------------------------------------------------------------
create or replace function public.erase_student(p_student_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_ids text[];
  v_days uuid[];
  v_day uuid;
  v_bookings integer;
  v_scrubbed integer;
begin
  if not exists (select 1 from public.students where id = p_student_id) then
    raise exception 'Studente inesistente.' using errcode = 'P0002';
  end if;
  select count(*)::integer into v_bookings from public.bookings where student_id = p_student_id;
  select array_agg(x) into v_ids from (
    select p_student_id::text x
    union all select id::text from public.bookings where student_id = p_student_id
    union all select id::text from public.waitlist_entries where student_id = p_student_id
    union all select id::text from public.seat_offers where student_id = p_student_id) t;

  -- giornate future in cui lo studente occupava un posto: il posto passa alla lista d'attesa
  select array_agg(distinct b.school_day_id) into v_days
    from public.bookings b join public.school_days d on d.id = b.school_day_id
   where b.student_id = p_student_id and b.status = 'confirmed' and d.day > public.school_today();

  perform set_config('bibliovolta.purge', 'on', true);
  delete from public.notification_outbox where student_id = p_student_id;
  delete from auth.users where id = p_student_id;   -- a cascata: profilo, prenotazioni, liste, proposte, comunicazioni
  perform set_config('bibliovolta.purge', '', true);

  foreach v_day in array coalesce(v_days, '{}'::uuid[]) loop
    perform public.process_day_waitlist(v_day);
  end loop;

  update public.audit_log
     set details = jsonb_build_object('anonimizzato', true), actor_id = null
   where entity_id = any (v_ids) or actor_id = p_student_id;
  get diagnostics v_scrubbed = row_count;

  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, details)
  values (null, null, 'privacy.cancellazione', 'students', null,
          jsonb_build_object('prenotazioni_cancellate', v_bookings, 'voci_registro_anonimizzate', v_scrubbed));
  return jsonb_build_object('bookings', v_bookings, 'audit_scrubbed', v_scrubbed);
end;
$$;

-- ---------------------------------------------------------------------
-- Cancellazione automatica allo scadere dei tempi di conservazione
-- ---------------------------------------------------------------------
create or replace function public.purge_expired_data()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  s public.app_settings;
  v_cut_day date;
  v_r jsonb := '{}'::jsonb;
  v_n integer;
  r record;
  v_students integer := 0;
begin
  select * into s from public.app_settings where id = 1;
  v_cut_day := (public.school_today() - make_interval(months => s.retention_months))::date;
  perform set_config('bibliovolta.purge', 'on', true);

  delete from public.auth_attempts where created_at < now() - make_interval(days => s.technical_retention_days);
  get diagnostics v_n = row_count; v_r := v_r || jsonb_build_object('tentativi_accesso', v_n);

  delete from public.notification_outbox
   where status in ('sent', 'failed') and created_at < now() - make_interval(days => s.technical_retention_days);
  get diagnostics v_n = row_count; v_r := v_r || jsonb_build_object('email_in_coda', v_n);

  delete from public.announcements a
   using public.school_days d
   where d.id = a.school_day_id and d.day < v_cut_day;
  get diagnostics v_n = row_count; v_r := v_r || jsonb_build_object('comunicazioni', v_n);
  delete from public.announcements
   where school_day_id is null and coalesce(published_at, created_at) < now() - make_interval(months => s.retention_months);

  delete from public.seat_offers o using public.school_days d where d.id = o.school_day_id and d.day < v_cut_day;
  get diagnostics v_n = row_count; v_r := v_r || jsonb_build_object('proposte', v_n);
  delete from public.waitlist_entries w using public.school_days d where d.id = w.school_day_id and d.day < v_cut_day;
  get diagnostics v_n = row_count; v_r := v_r || jsonb_build_object('liste_attesa', v_n);
  delete from public.bookings b using public.school_days d where d.id = b.school_day_id and d.day < v_cut_day;
  get diagnostics v_n = row_count; v_r := v_r || jsonb_build_object('prenotazioni', v_n);

  delete from public.audit_log where occurred_at < now() - make_interval(months => s.audit_retention_months);
  get diagnostics v_n = row_count; v_r := v_r || jsonb_build_object('registro', v_n);

  -- profili senza alcuna attività nel periodo (es. studenti diplomati)
  for r in
    select st.id from public.students st
     where st.created_at < now() - make_interval(months => s.inactive_student_months)
       and not exists (select 1 from public.bookings b where b.student_id = st.id
                        and b.created_at >= now() - make_interval(months => s.inactive_student_months))
       and not exists (select 1 from public.waitlist_entries w where w.student_id = st.id
                        and w.joined_at >= now() - make_interval(months => s.inactive_student_months))
  loop
    delete from public.notification_outbox where student_id = r.id;
    delete from auth.users where id = r.id;
    v_students := v_students + 1;
  end loop;
  v_r := v_r || jsonb_build_object('profili_inattivi', v_students);

  perform set_config('bibliovolta.purge', '', true);
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, details)
  values (null, null, 'privacy.conservazione', 'app_settings', '1', v_r);
  return v_r;
end;
$$;

-- ---------------------------------------------------------------------
-- Privilegi
-- ---------------------------------------------------------------------
revoke execute on function
  public.audit_redact(jsonb), public.minimize_auth_metadata(), public.erase_student(uuid),
  public.purge_expired_data(), public.export_my_data()
  from public, anon;
revoke execute on function public.erase_student(uuid), public.purge_expired_data(), public.minimize_auth_metadata() from authenticated;
grant execute on function public.export_my_data() to authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.erase_student(uuid), public.purge_expired_data() to service_role;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Supabase Cron: conservazione ogni notte alle 03:17 (UTC)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.schedule('bibliovolta-conservazione', '17 3 * * *', 'select public.purge_expired_data()');
    exception when others then
      raise notice 'BIBLIOVOLTA: pianificazione della conservazione non riuscita (%). Vedi docs/PUBBLICAZIONE.md.', sqlerrm;
    end;
  else
    raise notice 'BIBLIOVOLTA: pg_cron non attivo; pianifica select public.purge_expired_data() ogni notte (docs/PUBBLICAZIONE.md).';
  end if;
end;
$$;
