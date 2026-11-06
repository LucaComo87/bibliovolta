/**
 * BIBLIOVOLTA · Test automatici del database
 *
 * Applica tutte le migrazioni in supabase/migrations su un PostgreSQL
 * reale in memoria (PGlite) con uno "stub" minimo dell'ambiente
 * Supabase (schema auth, auth.uid(), ruoli anon/authenticated), poi
 * verifica calendario, creazione profili, autorizzazioni RLS,
 * limite di capienza e registro operazioni.
 *
 *   npm run db:test
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_app_meta_data jsonb default '{}'::jsonb,
    raw_user_meta_data jsonb default '{}'::jsonb,
    created_at timestamptz default now()
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated, service_role;
`;

type Check = { name: string; ok: boolean; detail?: string };
const results: Check[] = [];
function check(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
}

async function main() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);

  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    try {
      await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
      check(`migrazione ${file}`, true);
    } catch (e) {
      check(`migrazione ${file}`, false, (e as Error).message);
      return report();
    }
  }

  // ---- utilità per impersonare un utente ------------------------------
  const asUser = async (id: string | null) => {
    await db.exec("reset role");
    if (id === null) {
      await db.query("select set_config('request.jwt.claim.sub', '', false)");
      await db.exec("set role anon");
    } else {
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
      await db.exec("set role authenticated");
    }
  };
  const asSystem = async () => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  };
  const fails = async (sql: string, params: unknown[] = []) => {
    try {
      await db.query(sql, params);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  };

  // ---- 1. calendario ---------------------------------------------------
  const days = await db.query<{ n: number; first: string; last: string; weekend: number }>(`
    select count(*)::int as n, min(day)::text as first, max(day)::text as last,
           count(*) filter (where extract(isodow from day) > 5)::int as weekend
      from public.school_days`);
  const d = days.rows[0];
  check("calendario: prima giornata 2026-11-16", d.first === "2026-11-16", d.first);
  check("calendario: ultima giornata 2027-06-04", d.last === "2027-06-04", d.last);
  check("calendario: nessun sabato/domenica", d.weekend === 0);
  check(`calendario: ${d.n} giornate feriali generate`, d.n === 145, String(d.n));

  const cap = await db.query<{ ok: boolean }>(`
    select bool_and(capacity = 50 and opens_at = '14:15' and closes_at = '16:30') as ok from public.school_days`);
  check("calendario: 50 posti, 14:15–16:30", cap.rows[0].ok === true);

  check(
    "calendario: sabato rifiutato",
    (await fails("insert into public.school_days (day) values ('2026-11-21')")) !== null,
  );
  check(
    "calendario: giorno fuori stagione rifiutato",
    (await fails("insert into public.school_days (day) values ('2027-06-07')")) !== null,
  );

  // ---- 2. creazione profili --------------------------------------------
  const newUser = async (email: string, app: object = {}, meta: object = {}) =>
    (
      await db.query<{ id: string }>(
        "insert into auth.users (email, raw_app_meta_data, raw_user_meta_data) values ($1, $2, $3) returning id",
        [email, JSON.stringify(app), JSON.stringify(meta)],
      )
    ).rows[0].id;

  const google = { provider: "google", providers: ["google"] };
  const verified = { email_verified: true };
  const studA = await newUser("mario.rossi@stud.liceovoltacomo.edu.it", google, {
    ...verified, full_name: "Mario Rossi", given_name: "Mario", family_name: "Rossi",
  });
  const studB = await newUser("anna.bianchi@stud.liceovoltacomo.edu.it", google, { ...verified, full_name: "Anna Bianchi" });
  await db.query("insert into public.teacher_invitations (email, full_name) values ('docente@liceovoltacomo.edu.it', 'Prof. Test')");
  const teacher = await newUser("docente@liceovoltacomo.edu.it", { provider: "email" }, { full_name: "Prof. Test" });

  const prof = await db.query<{ n: number }>("select count(*)::int as n from public.students");
  check("profili: studenti creati automaticamente dal dominio", prof.rows[0].n === 2);
  const t = await db.query<{ n: number }>("select count(*)::int as n from public.teachers");
  check("profili: docente creato solo da email pre-autorizzata", t.rows[0].n === 1);
  check("profili: invito consumato", (await db.query("select 1 from public.teacher_invitations")).rows.length === 0);

  check(
    "profili: email esterna rifiutata",
    (await fails("insert into auth.users (email) values ('pinco@gmail.com')")) !== null,
  );
  check(
    "profili: email studente senza Google rifiutata",
    (await fails(
      "insert into auth.users (email, raw_app_meta_data) values ('furbo@stud.liceovoltacomo.edu.it', '{\"provider\":\"email\"}')",
    )) !== null,
  );
  check(
    "profili: account email+password non invitato rifiutato",
    (await fails("insert into auth.users (email, raw_app_meta_data) values ('altro@liceovoltacomo.edu.it', '{\"provider\":\"email\"}')")) !== null,
  );

  const day1 = (await db.query<{ id: string }>("select id from public.school_days where day = '2026-11-16'")).rows[0].id;
  const day2 = (await db.query<{ id: string }>("select id from public.school_days where day = '2026-11-17'")).rows[0].id;

  // ---- 3. utente anonimo -----------------------------------------------
  await asUser(null);
  check("anon: nessun accesso alle giornate", (await fails("select * from public.school_days")) !== null);
  check("anon: nessun accesso agli studenti", (await fails("select * from public.students")) !== null);
  check(
    "anon: nessun accesso alla disponibilità",
    (await fails("select * from public.get_day_availability('2026-11-16', '2026-11-20')")) !== null,
  );

  // ---- 4. docente ------------------------------------------------------
  await asUser(teacher);
  const role = await db.query<{ r: string }>("select public.current_app_role()::text as r");
  check("docente: ruolo riconosciuto", role.rows[0].r === "teacher");
  await db.query(
    "insert into public.bookings (student_id, school_day_id, source, created_by) values ($1, $2, 'teacher', $3), ($4, $2, 'teacher', $3)",
    [studA, day1, teacher, studB],
  );
  check("docente: può inserire prenotazioni", true);
  check(
    "docente: doppia prenotazione stesso giorno rifiutata",
    (await fails("insert into public.bookings (student_id, school_day_id) values ($1, $2)", [studA, day1])) !== null,
  );
  await db.query("update public.school_days set capacity = 2 where id = $1", [day2]);
  await db.query("insert into public.bookings (student_id, school_day_id) values ($1, $3), ($2, $3)", [studA, studB, day2]);
  const third = await newUserAsSystem("luca.verdi@stud.liceovoltacomo.edu.it");
  await asUser(teacher);
  const overflow = await fails("insert into public.bookings (student_id, school_day_id) values ($1, $2)", [third, day2]);
  check("capienza: oltre il limite rifiutato", overflow !== null && overflow.includes("posti esauriti"), overflow ?? "");
  check(
    "capienza: non si può scendere sotto i posti prenotati",
    (await fails("update public.school_days set capacity = 1 where id = $1", [day2])) !== null,
  );
  await db.query(
    "update public.school_days set is_open = false, closure_reason = 'Sospensione attività' where day = '2026-11-18'",
  );
  check(
    "chiusura: prenotazione in giornata chiusa rifiutata",
    (await fails(
      "insert into public.bookings (student_id, school_day_id) select $1, id from public.school_days where day = '2026-11-18'",
      [third],
    )) !== null,
  );
  const audit = await db.query<{ n: number }>("select count(*)::int as n from public.audit_log where actor_id = $1", [teacher]);
  check("registro: operazioni del docente registrate", audit.rows[0].n >= 4, String(audit.rows[0].n));

  // ---- 5. studente -----------------------------------------------------
  await asUser(studA);
  const roleS = await db.query<{ r: string }>("select public.current_app_role()::text as r");
  check("studente: ruolo riconosciuto", roleS.rows[0].r === "student");
  const myProfiles = await db.query<{ email: string }>("select email from public.students");
  check(
    "studente: vede solo il proprio profilo",
    myProfiles.rows.length === 1 && myProfiles.rows[0].email.startsWith("mario"),
  );
  const myBookings = await db.query<{ student_id: string }>("select student_id from public.bookings");
  check(
    "studente: vede solo le proprie prenotazioni",
    myBookings.rows.length === 2 && myBookings.rows.every((r) => r.student_id === studA),
  );
  const teachersSeen = await db.query("select * from public.teachers");
  check("studente: non vede i docenti", teachersSeen.rows.length === 0);
  const auditSeen = await db.query("select * from public.audit_log");
  check("studente: non vede il registro operazioni", auditSeen.rows.length === 0);
  check(
    "studente: non può inserire prenotazioni direttamente",
    (await fails("insert into public.bookings (student_id, school_day_id) values ($1, $2)", [studA, day2])) !== null,
  );
  await db.query("update public.bookings set status = 'cancelled', cancelled_at = now()");
  await asSystem();
  const stillConfirmed = await db.query<{ n: number }>(
    "select count(*)::int as n from public.bookings where student_id = $1 and status = 'confirmed'", [studA],
  );
  check("studente: non può modificare le prenotazioni", stillConfirmed.rows[0].n === 2);
  await asUser(studA);
  check(
    "studente: non può chiudere giornate",
    (await db.query("update public.school_days set is_open = false, closure_reason = 'x' returning id")).rows.length === 0,
  );
  check(
    "studente: non può modificare le impostazioni",
    (await db.query("update public.app_settings set default_capacity = 999 returning id")).rows.length === 0,
  );
  check(
    "studente: non può scrivere nel registro",
    (await fails("insert into public.audit_log (action, entity_type) values ('x', 'y')")) !== null,
  );
  check(
    "studente: non può generare giornate",
    (await fails("select public.generate_school_days('2026-11-16', '2026-11-20')")) !== null,
  );
  const avail = await db.query<{ day: string; booked: number; available: number; is_open: boolean }>(
    "select day::text, booked, available, is_open from public.get_day_availability('2026-11-16', '2026-11-18')",
  );
  const [a16, a17, a18] = avail.rows;
  check(
    "disponibilità: conteggi corretti senza dati personali",
    a16.booked === 2 && a16.available === 48 && a17.available === 0 && a18.is_open === false && a18.available === 0,
    JSON.stringify(avail.rows),
  );


  // ---- 6. Fase 3: autenticazione e registrazione ------------------------
  await asSystem();
  const insUser = (email: string, app: object, meta: object) =>
    fails("insert into auth.users (email, raw_app_meta_data, raw_user_meta_data) values ($1, $2, $3)", [
      email, JSON.stringify(app), JSON.stringify(meta),
    ]);
  check("google: email non verificata rifiutata", (await insUser("non.verificato@stud.liceovoltacomo.edu.it", google, { email_verified: false })) !== null);
  check("google: account Gmail personale rifiutato", (await insUser("mario.rossi@gmail.com", google, verified)) !== null);
  check("google: altro dominio Google rifiutato", (await insUser("prof@liceovoltacomo.edu.it", google, verified)) !== null);
  check("google: sottodominio ingannevole rifiutato", (await insUser("x@evil.stud.liceovoltacomo.edu.it", google, verified)) !== null);
  check("google: dominio come prefisso rifiutato", (await insUser("x@stud.liceovoltacomo.edu.it.evil.com", google, verified)) !== null);
  check("google: doppia chiocciola rifiutata", (await insUser("a@b@stud.liceovoltacomo.edu.it", google, verified)) !== null);
  check(
    "email: uno studente non può passare a un altro dominio",
    (await fails("update auth.users set email = 'mario@gmail.com' where id = $1", [studA])) !== null,
  );
  const tdef = await db.query<{ m: boolean }>("select must_change_password as m from public.teachers where id = $1", [teacher]);
  check("docente: cambio password obbligatorio al primo accesso", tdef.rows[0].m === true);

  // registrazione
  await asUser(null);
  check(
    "registrazione: vietata agli utenti non autenticati",
    (await fails("select public.complete_student_registration('A', 'B', '4B')")) !== null,
  );
  await asUser(studA);
  check("registrazione: classe non valida rifiutata", (await fails("select public.complete_student_registration('Mario', 'Rossi', '6Z')")) !== null);
  check("registrazione: nome con caratteri non ammessi rifiutato", (await fails("select public.complete_student_registration('<script>', 'Rossi', '4B')")) !== null);
  await db.query("select public.complete_student_registration('  Mario ', 'D''Angelo', '4b')");
  const regA = await db.query<{ first_name: string; last_name: string; class_name: string; full_name: string; registered: boolean }>(
    "select first_name, last_name, class_name, full_name, registered_at is not null as registered from public.students where id = $1", [studA],
  );
  const ra = regA.rows[0];
  check(
    "registrazione: dati salvati e normalizzati",
    ra.first_name === "Mario" && ra.last_name === "D'Angelo" && ra.class_name === "4B" && ra.full_name === "Mario D'Angelo" && ra.registered,
    JSON.stringify(ra),
  );
  check("registrazione: non ripetibile", (await fails("select public.complete_student_registration('Altro', 'Nome', '1A')")) !== null);
  await asUser(studB);
  await db.query("select public.complete_student_registration('Anna', 'Bianchi', '5A')");
  await asSystem();
  const after = await db.query<{ first_name: string }>("select first_name from public.students where id = $1", [studA]);
  check("registrazione: uno studente non modifica i dati di un altro", after.rows[0].first_name === "Mario");
  await asUser(third);
  check("registrazione: nomi con accenti accettati", (await fails("select public.complete_student_registration('Nicolò', 'Lì', '3C')")) === null);

  // funzioni riservate al server
  await asUser(studA);
  check("studente: non può segnare cambiata la password di un docente", (await fails("select public.mark_teacher_password_changed($1)", [teacher])) !== null);
  check("studente: non può leggere i tentativi di accesso", (await fails("select * from public.auth_attempts")) !== null);
  check("studente: non può leggere gli inviti docenti", (await fails("select * from public.teacher_invitations")) !== null);
  check("studente: non può auto-invitarsi come docente", (await fails("insert into public.teacher_invitations (email) values ('x@y.it')")) !== null);
  check("studente: non può scrivere tentativi di accesso", (await fails("select public.record_auth_attempt('teacher_login', 'x@y.it', '1.1.1.1', true)")) !== null);
  await asUser(teacher);
  check("docente: non può azzerare da solo l'obbligo di cambio password", (await fails("select public.mark_teacher_password_changed($1)", [teacher])) !== null);

  // blocco dei tentativi ripetuti (eseguito come service role)
  await db.exec("reset role");
  await db.exec("set role service_role");
  const lock = async (email: string, ip: string) =>
    (await db.query<{ s: number }>("select public.auth_lockout_seconds($1, $2) as s", [email, ip])).rows[0].s;
  const fail = (email: string, ip: string) =>
    db.query("select public.record_auth_attempt('teacher_login', $1, $2, false)", [email, ip]);
  for (let i = 0; i < 4; i++) await fail("docente@liceovoltacomo.edu.it", "10.0.0.1");
  check("tentativi: 4 errori non bloccano", (await lock("docente@liceovoltacomo.edu.it", "10.0.0.1")) === 0);
  await fail("docente@liceovoltacomo.edu.it", "10.0.0.1");
  const secs = await lock("DOCENTE@liceovoltacomo.edu.it", "10.0.0.9");
  check("tentativi: al 5° errore l'email è bloccata per 15 minuti", secs > 850 && secs <= 900, String(secs));
  for (let i = 0; i < 20; i++) await fail(`altro${i}@liceovoltacomo.edu.it`, "10.0.0.2");
  check("tentativi: 20 errori dallo stesso IP bloccano l'IP", (await lock("nuovo@liceovoltacomo.edu.it", "10.0.0.2")) > 0);
  check("tentativi: un IP diverso non è bloccato", (await lock("nuovo@liceovoltacomo.edu.it", "10.0.0.3")) === 0);
  await db.query("select public.record_auth_attempt('teacher_login', 'ok@liceovoltacomo.edu.it', '10.0.0.4', false)");
  await db.query("select public.record_auth_attempt('teacher_login', 'ok@liceovoltacomo.edu.it', '10.0.0.4', true)");
  check("tentativi: un accesso riuscito azzera il conteggio", (await lock("ok@liceovoltacomo.edu.it", "10.0.0.4")) === 0);
  await db.query("select public.mark_teacher_password_changed($1)", [teacher]);
  await db.exec("reset role");
  const changed = await db.query<{ m: boolean }>("select must_change_password as m from public.teachers where id = $1", [teacher]);
  check("server: può segnare la password come cambiata", changed.rows[0].m === false);


  // ---- 7. Fase 4: prenotazioni ------------------------------------------
  await db.exec("reset role");
  await asSystem();
  const dayId = async (d: string) => (await db.query<{ id: string }>("select id from public.school_days where day = $1", [d])).rows[0]?.id;
  const holiday = await db.query<{ is_open: boolean; closure_reason: string }>("select is_open, closure_reason from public.school_days where day = '2026-12-08'");
  check("festività: 8 dicembre chiuso fin dall'inizio", holiday.rows[0].is_open === false && holiday.rows[0].closure_reason === "Immacolata Concezione");
  const closedCount = await db.query<{ n: number }>(
    "select count(*)::int n from public.school_days where not is_open and day in ('2026-12-08','2026-12-25','2027-01-01','2027-01-06','2027-03-29','2027-06-02')",
  );
  check("festività: 6 festività nazionali feriali chiuse", closedCount.rows[0].n === 6, String(closedCount.rows[0].n));

  // ora solare / legale
  const dl = await db.query<{ a: string; b: string; c: string; d: string }>(`select
    to_char(public.cancellation_deadline('2026-11-16', '14:15') at time zone 'UTC', 'YYYY-MM-DD HH24:MI') a,
    to_char(public.cancellation_deadline('2027-03-29', '14:15') at time zone 'UTC', 'YYYY-MM-DD HH24:MI') b,
    to_char(public.cancellation_deadline('2027-04-12', '14:15') at time zone 'UTC', 'YYYY-MM-DD HH24:MI') c,
    to_char(public.day_opening_at('2026-10-26', '14:15') at time zone 'UTC', 'YYYY-MM-DD HH24:MI') d`);
  const r = dl.rows[0];
  check("orari: scadenza con ora solare (16/11 → 15/11 13:15 UTC)", r.a === "2026-11-15 13:15", r.a);
  check("orari: scadenza a cavallo del cambio d'ora (29/3 → 28/3 12:15 UTC)", r.b === "2027-03-28 12:15", r.b);
  check("orari: scadenza con ora legale (12/4 → 11/4 12:15 UTC)", r.c === "2027-04-11 12:15", r.c);
  check("orari: apertura dopo il ritorno all'ora solare (26/10 14:15 → 13:15 UTC)", r.d === "2026-10-26 13:15", r.d);

  // 50 studenti registrati di prova
  const many: string[] = [];
  for (let i = 0; i < 51; i++) {
    many.push(await newUser(`studente${i}@stud.liceovoltacomo.edu.it`, google, verified));
  }
  await db.query("update public.students set registered_at = now(), first_name = 'Prova', last_name = 'Studente', class_name = '3A' where registered_at is null and email like 'studente%'");
  const unregistered = await newUser("nonregistrato@stud.liceovoltacomo.edu.it", google, verified);

  const book = async (uid: string, d: string) => {
    await asUser(uid);
    const id = await (async () => { await asSystem(); return dayId(d); })();
    await asUser(uid);
    try {
      const res = await db.query<{ id: string }>("select (public.book_seat($1)).id as id", [id]);
      return { ok: true as const, id: res.rows[0].id };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  };
  const countConfirmed = async (d: string) => {
    await asSystem();
    return (await db.query<{ n: number }>("select count(*)::int n from public.bookings b join public.school_days s on s.id = b.school_day_id where s.day = $1 and b.status = 'confirmed'", [d])).rows[0].n;
  };

  const first = await book(studA, "2026-11-20");
  check("prenotazione: prenotazione normale riuscita", first.ok, first.ok ? "" : first.error);
  const dup = await book(studA, "2026-11-20");
  check("prenotazione: la stessa giornata non si prenota due volte", !dup.ok && dup.error.includes("già una prenotazione"), dup.ok ? "" : dup.error);
  check("prenotazione: vietata a chi non ha completato la registrazione", !(await book(unregistered, "2026-11-20")).ok);
  check("prenotazione: vietata nelle giornate chiuse", !(await book(studB, "2026-12-08")).ok);
  await asUser(null);
  check("prenotazione: vietata agli utenti non autenticati", (await fails("select public.book_seat(gen_random_uuid())")) !== null);

  for (let i = 0; i < 48; i++) {
    const b = await book(many[i], "2026-11-20");
    if (!b.ok) { check(`prenotazione ${i + 2}`, false, b.error); break; }
  }
  check("limite: 49 prenotazioni registrate", (await countConfirmed("2026-11-20")) === 49);
  const last = await book(many[48], "2026-11-20");
  check("limite: l'ultimo posto (50°) si prenota", last.ok && (await countConfirmed("2026-11-20")) === 50, last.ok ? "" : last.error);
  const over = await book(many[49], "2026-11-20");
  check(
    "limite: la 51ª prenotazione è bloccata con il messaggio previsto",
    !over.ok && over.error.includes("È stato raggiunto il numero massimo di 50 prenotazioni. Puoi iscriverti alla lista d'attesa."),
    over.ok ? "accettata!" : over.error,
  );
  check("limite: mai più di 50 prenotazioni attive", (await countConfirmed("2026-11-20")) === 50);
  await asUser(studB);
  const availFull = (await db.query<{ booked: number; available: number }>("select booked, available from public.get_day_availability('2026-11-20', '2026-11-20')")).rows[0];
  check("calendario: la disponibilità mostra 50 prenotati e 0 posti", availFull.booked === 50 && availFull.available === 0, JSON.stringify(availFull));

  // annullamento
  await asUser(studA);
  const cancel = await fails("select public.cancel_booking($1)", [first.ok ? first.id : null]);
  check("annullamento: entro i termini riuscito", cancel === null, cancel ?? "");
  check("annullamento: il posto torna subito disponibile", (await countConfirmed("2026-11-20")) === 49);
  await asUser(studB);
  const avail2 = (await db.query<{ available: number }>("select available from public.get_day_availability('2026-11-20', '2026-11-20')")).rows[0];
  check("calendario: aggiornato subito dopo l'annullamento", avail2.available === 1);
  check("annullamento: non si annulla due volte", (await (async () => { await asUser(studA); return fails("select public.cancel_booking($1)", [first.ok ? first.id : null]); })()) !== null);
  const other = await book(many[49], "2026-11-20");
  check("annullamento: il posto liberato può essere preso da un altro", other.ok);
  await asUser(studB);
  check(
    "annullamento: non si può annullare la prenotazione di un altro",
    (await fails("select public.cancel_booking($1)", [other.ok ? other.id : null])) !== null,
  );
  const again = await book(studA, "2026-11-20");
  check("prenotazione: dopo l'annullamento la giornata completa resta bloccata", !again.ok);

  // scadenza delle 24 ore: si rende "vicina" una giornata della settimana prossima
  await asSystem();
  await db.query("update public.app_settings set season_start = public.school_today()");
  await db.query("select public.generate_school_days(public.school_today() + 1, public.school_today() + 9)");
  const soon = (await db.query<{ day: string }>("select day::text from public.school_days where day > public.school_today() and is_open order by day limit 1")).rows[0].day;
  await db.query("update public.app_settings set cancellation_hours = 168");
  const late = await book(studA, soon);
  check("scadenza: si può ancora prenotare prima dell'apertura", late.ok, late.ok ? "" : late.error);
  await asUser(studA);
  const mine = await db.query<{ can_cancel: boolean }>("select can_cancel from public.my_bookings() where day = $1 and status = 'confirmed'", [soon]);
  check("scadenza: my_bookings segnala che non è più annullabile", mine.rows[0]?.can_cancel === false);
  const lateCancel = await fails("select public.cancel_booking($1)", [late.ok ? late.id : null]);
  check("scadenza: l'annullamento dopo il termine è rifiutato dal server", lateCancel !== null && lateCancel.includes("Non è più possibile annullare"), lateCancel ?? "accettato!");
  await asSystem();
  await db.query("update public.app_settings set cancellation_hours = 24");

  // area personale e orari
  await asUser(studA);
  const own = await db.query<{ n: number }>("select count(*)::int n from public.my_bookings()");
  const ownAll = await db.query<{ n: number }>("select count(*)::int n from public.my_bookings() mb join public.bookings b on b.id = mb.booking_id where b.student_id <> $1", [studA]);
  check("area personale: my_bookings restituisce solo le proprie", own.rows[0].n >= 2 && ownAll.rows[0].n === 0);
  check("orari: uno studente non può cambiare l'orario", (await fails("select public.set_opening_hours('09:00', '10:00')")) !== null);
  await asUser(teacher);
  check("orari: orario non valido rifiutato", (await fails("select public.set_opening_hours('16:00', '15:00')")) !== null);
  await db.query("select public.set_opening_hours('14:30', '16:45')");
  await asSystem();
  const hours = await db.query<{ o: string; c: string; past: string }>(
    "select (select default_opens_at::text from public.app_settings) o, (select opens_at::text from public.school_days where day = '2026-12-01') c, (select opens_at::text from public.school_days where day = public.school_today() - 0 limit 1) past",
  );
  check("orari: il docente cambia l'orario predefinito e delle giornate future", hours.rows[0].o === "14:30:00" && hours.rows[0].c === "14:30:00", JSON.stringify(hours.rows[0]));
  await asUser(teacher);
  await db.query("select public.set_opening_hours('14:15', '16:30')");


  // ---- 8. Fase 5: lista d'attesa -----------------------------------------
  await asSystem();
  const D = "2026-11-27";
  const dId = await dayId(D);
  const waiters: string[] = [];
  for (let i = 0; i < 4; i++) waiters.push(await newUser(`attesa${i}@stud.liceovoltacomo.edu.it`, google, verified));
  await db.query("update public.students set registered_at = now(), first_name = 'Attesa', last_name = 'Studente', class_name = '2B' where email like 'attesa%'");
  const asSvc = async () => { await db.exec("reset role"); await db.exec("set role service_role"); };
  const joinW = async (uid: string) => {
    await asUser(uid);
    try {
      const r = await db.query<{ queue_position: number; entry_id: string }>("select * from public.join_waitlist($1)", [dId]);
      return { ok: true as const, pos: r.rows[0].queue_position, id: r.rows[0].entry_id };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  };
  const outbox = async (kind: string) => {
    await asSystem();
    return (await db.query<{ student_id: string; payload: { token?: string } }>("select student_id, payload from public.notification_outbox where kind = $1 order by id", [kind])).rows;
  };
  const offerOf = async (uid: string) => {
    await asSystem();
    return (await db.query<{ id: string; status: string; expires_at: string; offered_at: string }>(
      "select id, status, expires_at::text, offered_at::text from public.seat_offers where student_id = $1 and school_day_id = $2 order by offered_at desc limit 1", [uid, dId])).rows[0];
  };

  const early = await joinW(waiters[0]);
  check("lista: iscrizione rifiutata se ci sono posti liberi", !early.ok && early.error.includes("posti liberi"), early.ok ? "" : early.error);
  for (let i = 0; i < 50; i++) {
    const b = await book(many[i], D);
    if (!b.ok) { check("lista: riempimento giornata", false, b.error); break; }
  }
  const j1 = await joinW(waiters[0]);
  const j2 = await joinW(waiters[1]);
  const j3 = await joinW(waiters[2]);
  check("lista: posizioni progressive 1, 2, 3", j1.ok && j2.ok && j3.ok && j1.pos === 1 && j2.pos === 2 && j3.pos === 3, JSON.stringify([j1, j2, j3]));
  const jd = await joinW(waiters[0]);
  check("lista: iscrizione duplicata rifiutata", !jd.ok && jd.error.includes("già in lista"));
  const jb = await joinW(many[0]);
  check("lista: chi ha già prenotato non si iscrive", !jb.ok);
  await asSystem();
  const times = (await db.query<{ joined_at: string }>("select joined_at::text from public.waitlist_entries where school_day_id = $1 order by queue_seq", [dId])).rows;
  check("lista: data e ora di iscrizione registrate in ordine", times.length === 3 && times[0].joined_at <= times[1].joined_at && times[1].joined_at <= times[2].joined_at);

  // un posto si libera → proposta al primo
  await asUser(many[0]);
  const bk0 = (await db.query<{ booking_id: string }>("select booking_id from public.my_bookings() where day = $1", [D])).rows[0].booking_id;
  await db.query("select public.cancel_booking($1)", [bk0]);
  const o1 = await offerOf(waiters[0]);
  check("proposta: creata per il primo in lista", o1?.status === "pending");
  const minutes = o1 ? (new Date(o1.expires_at).getTime() - new Date(o1.offered_at).getTime()) / 60000 : 0;
  check("proposta: scadenza a 2 ore", Math.round(minutes) === 120, String(minutes));
  const emails = await outbox("waitlist_offer");
  const token = emails.find((e) => e.student_id === waiters[0])?.payload.token ?? "";
  check("proposta: email in coda con token personale di 64 caratteri", /^[0-9a-f]{64}$/.test(token));
  await asSystem();
  const hashOnly = (await db.query<{ n: number }>("select count(*)::int n from public.seat_offers where token_hash = $1", [token])).rows[0].n;
  check("proposta: il token non è salvato in chiaro nella tabella delle proposte", hashOnly === 0);
  await asUser(waiters[3]);
  const av = (await db.query<{ booked: number; held: number; available: number; waiting: number }>("select booked, held, available, waiting from public.get_day_availability($1, $1)", [D])).rows[0];
  check("proposta: il posto è trattenuto (49 prenotati + 1 proposto, 0 liberi)", av.booked === 49 && av.held === 1 && av.available === 0, JSON.stringify(av));
  const steal = await book(waiters[3], D);
  check("proposta: nessuno può prenotare il posto trattenuto", !steal.ok && steal.error.includes("numero massimo di 50"));
  const pos2 = await joinW(waiters[3]);
  check("lista: dopo la proposta il secondo diventa 1° in coda, il nuovo iscritto 3°", pos2.ok && pos2.pos === 3, JSON.stringify(pos2));

  // sicurezza delle funzioni del server
  await asUser(waiters[0]);
  check("sicurezza: uno studente non può usare la conferma via token", (await fails("select public.accept_offer_by_token($1)", [token])) !== null);
  check("sicurezza: uno studente non legge la coda delle email", (await fails("select * from public.notification_outbox")) !== null);
  check("sicurezza: uno studente non avvia la manutenzione", (await fails("select public.run_waitlist_maintenance()")) !== null);
  await asUser(waiters[1]);
  check("sicurezza: uno studente non conferma la proposta di un altro", (await fails("select public.accept_my_offer($1)", [o1.id])) !== null);

  // conferma via link (server)
  await asSvc();
  check("conferma: token sbagliato rifiutato", (await fails("select public.accept_offer_by_token($1)", ["0".repeat(64)])) !== null);
  const acc = await fails("select public.accept_offer_by_token($1)", [token]);
  check("conferma: il link valido assegna il posto", acc === null, acc ?? "");
  check("conferma: il link non è riutilizzabile", (await fails("select public.accept_offer_by_token($1)", [token])) !== null);
  await asSystem();
  const st = (await db.query<{ e: string; b: number }>(
    "select (select status::text from public.waitlist_entries where student_id = $1 and school_day_id = $2) e, (select count(*)::int from public.bookings where student_id = $1 and school_day_id = $2 and status = 'confirmed') b", [waiters[0], dId])).rows[0];
  check("conferma: prenotazione registrata e studente tolto dalla lista", st.e === "assigned" && st.b === 1, JSON.stringify(st));
  check("conferma: email di conferma in coda", (await outbox("offer_confirmed")).some((e) => e.student_id === waiters[0]));
  check("conferma: 50 prenotazioni attive", (await countConfirmed(D)) === 50);

  // mancata conferma → passaggio al successivo
  await asUser(many[1]);
  const bk1 = (await db.query<{ booking_id: string }>("select booking_id from public.my_bookings() where day = $1", [D])).rows[0].booking_id;
  await db.query("select public.cancel_booking($1)", [bk1]);
  check("successivo: proposta al secondo in lista", (await offerOf(waiters[1]))?.status === "pending");
  await asSystem();
  await db.query("update public.seat_offers set expires_at = now() - interval '1 second', offered_at = now() - interval '2 hours' where student_id = $1 and status = 'pending'", [waiters[1]]);
  await asSvc();
  const m = (await db.query<{ r: { expired_offers: number; new_offers: number } }>("select public.run_waitlist_maintenance() r")).rows[0].r;
  check("scadenza: la manutenzione fa scadere la proposta", m.expired_offers === 1 && (await offerOf(waiters[1]))?.status === "expired", JSON.stringify(m));
  check("scadenza: email di proposta scaduta in coda", (await outbox("offer_expired")).some((e) => e.student_id === waiters[1]));
  check("successivo: proposta automatica al terzo", (await offerOf(waiters[2]))?.status === "pending");

  // uscita dalla lista con proposta aperta → il posto passa al successivo
  await asUser(waiters[2]);
  const myW = (await db.query<{ entry_id: string; entry_status: string; offer_status: string }>("select entry_id, entry_status::text, offer_status::text from public.my_waitlist() where day = $1", [D])).rows[0];
  check("area personale: my_waitlist mostra la proposta ricevuta", myW?.entry_status === "offered" && myW.offer_status === "pending");
  await db.query("select public.leave_waitlist($1)", [myW.entry_id]);
  check("cancellazione: uscita dalla lista con proposta aperta", (await offerOf(waiters[2]))?.status === "declined");
  check("cancellazione: il posto passa subito al successivo", (await offerOf(waiters[3]))?.status === "pending");

  // tempo di conferma modificabile dai docenti
  await asUser(waiters[3]);
  check("docenti: uno studente non cambia il tempo di conferma", (await fails("select public.set_offer_minutes(30)")) !== null);
  await asUser(teacher);
  check("docenti: tempo di conferma fuori dai limiti rifiutato", (await fails("select public.set_offer_minutes(5)")) !== null);
  await db.query("select public.set_offer_minutes(90)");
  await asSystem();
  check("docenti: tempo di conferma aggiornato", (await db.query<{ m: number }>("select offer_minutes m from public.app_settings")).rows[0].m === 90);

  // chiusura della giornata
  await asUser(teacher);
  await db.query("update public.school_days set is_open = false, closure_reason = 'Assemblea d''istituto' where id = $1", [dId]);
  check("chiusura: la proposta aperta viene annullata", (await offerOf(waiters[3]))?.status === "revoked");
  const booked = await outbox("day_closed_booked");
  const waitingMails = await outbox("day_closed_waitlist");
  check("chiusura: avviso a tutti i 49 prenotati (1 posto era in proposta)", booked.length === 49, String(booked.length));
  check("chiusura: avviso agli studenti in lista", waitingMails.some((e) => e.student_id === waiters[3]));
  const afterClose = await joinW(waiters[1]);
  check("chiusura: nuove iscrizioni bloccate", !afterClose.ok);
  check("chiusura: nuove prenotazioni bloccate", !(await book(waiters[1], D)).ok);
  await asUser(teacher);
  await db.query("update public.school_days set is_open = true, closure_reason = null where id = $1", [dId]);
  check("riapertura: la lista riparte con nuova proposta", (await (async () => { await asSystem(); return (await db.query<{ n: number }>("select count(*)::int n from public.seat_offers where school_day_id = $1 and status = 'pending'", [dId])).rows[0].n; })()) === 1);

  // sospensione della lista
  await asUser(teacher);
  await db.query("select public.set_waitlist_paused($1, true)", [dId]);
  await asUser(waiters[1]);
  const paused = await joinW(waiters[1]);
  check("sospensione: iscrizioni bloccate con lista sospesa", !paused.ok && paused.error.includes("sospesa"));

  // invio email: presa in carico atomica e cancellazione del token dopo l'invio
  await asSvc();
  const claimed = (await db.query<{ id: number; payload: { token?: string } }>("select id, payload from public.claim_notifications(500)")).rows;
  const withToken = claimed.find((c) => c.payload.token);
  check("email: presa in carico delle notifiche", claimed.length > 0);
  check("email: una notifica non viene presa due volte", (await db.query("select * from public.claim_notifications(500)")).rows.length === 0);
  await db.query("select public.complete_notification($1, true, 'msg_1', null)", [withToken!.id]);
  await asSystem();
  const cleared = (await db.query<{ p: { token?: string }; s: string }>("select payload p, status s from public.notification_outbox where id = $1", [withToken!.id])).rows[0];
  check("email: dopo l'invio il token in chiaro viene cancellato", cleared.s === "sent" && !cleared.p.token);


  // ---- 9. Fase 6: dashboard docenti e comunicazioni ------------------------
  await asSystem();
  const F = "2026-11-20";
  const fId = await dayId(F);
  const fBooked = await countConfirmed(F);
  const logCount = async (action: string) => {
    await asSystem();
    return (await db.query<{ n: number }>("select count(*)::int n from public.audit_log where action = $1 and actor_role = 'teacher'", [`docente.${action}`])).rows[0].n;
  };
  await asUser(studA);
  check("docenti: uno studente non invia comunicazioni", (await fails("select * from public.send_announcement($1, true, false, 'Oggetto', 'Messaggio di prova')", [fId])) !== null);
  check("docenti: uno studente non annulla prenotazioni altrui", (await fails("select public.teacher_cancel_booking(gen_random_uuid(), 'motivo', true)")) !== null);
  check("docenti: uno studente non chiude giornate", (await fails("select public.teacher_update_day($1, false, 50, '14:15', '16:30', null, 'x', 'none')", [fId])) !== null);
  check("docenti: uno studente non legge le statistiche", (await fails("select public.teacher_stats()")) !== null);

  await asUser(teacher);
  const rc = (await db.query<{ n: number }>("select public.announcement_recipients_count($1, true, false) n", [fId])).rows[0].n;
  check("comunicazioni: conteggio destinatari = prenotati", rc === fBooked, `${rc} vs ${fBooked}`);
  check("comunicazioni: oggetto troppo corto rifiutato", (await fails("select * from public.send_announcement($1, true, false, 'x', 'Messaggio di prova')", [fId])) !== null);
  const sent = (await db.query<{ announcement_id: string; recipients: number }>("select * from public.send_announcement($1, true, false, 'Cambio orario', 'Oggi si apre alle 15:00.', 'orario')", [fId])).rows[0];
  check("comunicazioni: inviata a tutti i prenotati", sent.recipients === fBooked);
  await asSystem();
  const q = (await db.query<{ n: number }>("select count(*)::int n from public.notification_outbox where kind = 'announcement' and delivery_id in (select id from public.announcement_deliveries where announcement_id = $1)", [sent.announcement_id])).rows[0].n;
  check("comunicazioni: una email in coda per ogni destinatario", q === fBooked);
  check("registro: invio della comunicazione registrato", (await logCount("comunicazione_inviata")) === 1);

  // esito dell'invio sul destinatario
  await asSvc();
  const claimedA = (await db.query<{ id: number; delivery_id: string }>("select id, delivery_id from public.claim_notifications(500) where kind = 'announcement'")).rows;
  await db.query("select public.complete_notification($1, true, 'ok-1', null)", [claimedA[0].id]);
  await db.query("select public.complete_notification($1, false, null, 'Errore temporaneo')", [claimedA[1].id]);
  const tmp = (await db.query<{ status: string }>("select status from public.notification_outbox where id = $1", [claimedA[1].id])).rows[0];
  check("email: errore temporaneo → nuovo tentativo automatico", tmp.status === "pending", tmp.status);
  await db.query("update public.notification_outbox set status = 'sending' where id = $1", [claimedA[1].id]);
  await db.query("select public.complete_notification($1, false, null, 'Casella inesistente', true)", [claimedA[1].id]);
  await asSystem();
  const ds = (await db.query<{ s: string; e: string | null }>("select email_status::text s, email_error e from public.announcement_deliveries where id = any($1) order by email_status", [[claimedA[0].delivery_id, claimedA[1].delivery_id]])).rows;
  check("comunicazioni: esito registrato per destinatario (inviata / non inviata con errore)", ds.some((d) => d.s === "sent") && ds.some((d) => d.s === "failed" && d.e === "Casella inesistente"), JSON.stringify(ds));
  await asUser(teacher);
  const retried = (await db.query<{ n: number }>("select public.retry_announcement($1) n", [sent.announcement_id])).rows[0].n;
  check("comunicazioni: nuovo invio dei falliti", retried === 1);
  await asUser(many[2]);
  const seen = await db.query("select id from public.announcements where id = $1", [sent.announcement_id]);
  check("comunicazioni: lo studente destinatario la vede nell'area personale", seen.rows.length === 1);
  await asUser(waiters[3]);
  const notSeen = await db.query("select id from public.announcements where id = $1", [sent.announcement_id]);
  check("comunicazioni: chi non è destinatario non la vede", notSeen.rows.length === 0);

  // annullamento manuale
  await asSystem();
  const victim = (await db.query<{ id: string; student_id: string }>("select id, student_id from public.bookings where school_day_id = $1 and status = 'confirmed' limit 1", [fId])).rows[0];
  await asUser(teacher);
  check("annullamento docente: motivo obbligatorio", (await fails("select public.teacher_cancel_booking($1, '', true)", [victim.id])) !== null);
  await db.query("select public.teacher_cancel_booking($1, 'Assenza non giustificata', true)", [victim.id]);
  await asSystem();
  const vb = (await db.query<{ status: string; cancel_reason: string; cancelled_by: string }>("select status::text, cancel_reason, cancelled_by from public.bookings where id = $1", [victim.id])).rows[0];
  check("annullamento docente: prenotazione annullata con motivo e autore", vb.status === "cancelled" && vb.cancel_reason === "Assenza non giustificata" && vb.cancelled_by === teacher);
  check("annullamento docente: email allo studente in coda", (await db.query<{ n: number }>("select count(*)::int n from public.notification_outbox where kind = 'booking_cancelled' and student_id = $1", [victim.student_id])).rows[0].n === 1);
  check("registro: annullamento manuale registrato", (await logCount("prenotazione_annullata")) === 1);

  // chiusura con comunicazione personalizzata, riapertura, orario
  await asUser(teacher);
  check("chiusura: motivo obbligatorio", (await fails("select public.teacher_update_day($1, false, 50, '14:15', '16:30', null, '', 'none')", [fId])) !== null);
  const before = await countConfirmed(F);
  await asUser(teacher);
  const res = (await db.query<{ r: { booked: number; notified: number } }>(
    "select public.teacher_update_day($1, false, 50, '14:15', '16:30', null, 'Sciopero', 'custom', 'Aula studio chiusa', 'Domani l''aula resterà chiusa per sciopero.') r", [fId])).rows[0].r;
  check("chiusura: comunicazione personalizzata ai prenotati", res.booked === before && res.notified === before, JSON.stringify(res));
  await asSystem();
  const defaultMails = (await db.query<{ n: number }>("select count(*)::int n from public.notification_outbox where kind like 'day_closed%' and payload->>'day' = $1", [F])).rows[0].n;
  check("chiusura: con messaggio personalizzato niente avviso predefinito doppio", defaultMails === 0);
  check("registro: chiusura registrata con motivo", (await logCount("giornata_chiusa")) === 1);
  await asUser(teacher);
  await db.query("select public.teacher_update_day($1, true, 50, '15:00', '17:00', 'Ingresso dal cortile', null, 'none')", [fId]);
  check("registro: riapertura e cambio orario registrati", (await logCount("giornata_riaperta")) === 1 && (await logCount("orario_giornata")) === 1);
  await asSystem();
  const reopened = (await db.query<{ is_open: boolean; o: string; note: string }>("select is_open, opens_at::text o, note from public.school_days where id = $1", [fId])).rows[0];
  check("calendario: giornata riaperta con nuovo orario e nota", reopened.is_open && reopened.o === "15:00:00" && reopened.note === "Ingresso dal cortile");
  await asUser(teacher);
  await db.query("select public.set_offer_minutes(120)");
  check("registro: modifica delle impostazioni registrata", (await logCount("impostazioni")) >= 2);

  // statistiche
  await asUser(teacher);
  const st6 = (await db.query<{ s: { total_bookings: number; avg_occupancy: number; classes: unknown[]; top_days: unknown[] } }>("select public.teacher_stats() s")).rows[0].s;
  await asSystem();
  const realTotal = (await db.query<{ n: number }>("select count(*)::int n from public.bookings where status = 'confirmed'")).rows[0].n;
  check("statistiche: totale prenotazioni coerente con il database", st6.total_bookings === realTotal, `${st6.total_bookings} vs ${realTotal}`);
  check("statistiche: occupazione, classi e giornate più frequentate", st6.avg_occupancy > 0 && st6.classes.length > 0 && st6.top_days.length > 0);

  // ---- 10. Fase 7 · privacy, conservazione, sicurezza --------------------
  await asSystem();
  const priv = await newUser("privacy.prova@stud.liceovoltacomo.edu.it", google, { ...verified, full_name: "Pia Privata", picture: "https://foto.example/pia.jpg", custom_claims: { given_name: "Pia", picture: "x" } });
  const meta = (await db.query<{ m: Record<string, unknown> }>("select raw_user_meta_data m from auth.users where id = $1", [priv])).rows[0].m;
  check("privacy: la foto dell'account Google non viene conservata", !("picture" in meta) && !("picture" in (meta.custom_claims as object)) && meta.full_name === "Pia Privata");
  const auditPriv = (await db.query<{ t: string }>("select details::text t from public.audit_log where entity_type = 'students' and entity_id = $1", [priv])).rows.map((r) => r.t).join(" ");
  check("privacy: il registro tecnico non contiene email e nomi degli studenti", auditPriv.length > 0 && !auditPriv.includes("privacy.prova@") && !auditPriv.includes("Pia Privata"), auditPriv.slice(0, 200));
  const anyEmail = (await db.query<{ n: number }>("select count(*)::int n from public.audit_log where action not like 'docente.%' and details::text like '%@stud.liceovoltacomo.edu.it%'")).rows[0].n;
  check("privacy: nessuna email nel registro tecnico (anche righe precedenti)", anyEmail === 0, String(anyEmail));
  const tokenInAudit = (await db.query<{ n: number }>("select count(*)::int n from public.audit_log where details::text like '%token_hash%'")).rows[0].n;
  check("sicurezza: gli hash dei link non finiscono nel registro", tokenInAudit === 0);

  // inviti docenti con scadenza
  await db.query("insert into public.teacher_invitations (email, full_name, created_at) values ('vecchio.invito@liceovoltacomo.edu.it', 'Vecchio', now() - interval '2 hours')");
  check("sicurezza: invito docente scaduto (oltre 30 minuti) rifiutato", (await fails("insert into auth.users (email, raw_app_meta_data) values ('vecchio.invito@liceovoltacomo.edu.it', '{\"provider\":\"email\"}')")) !== null);
  await db.query("insert into public.teacher_invitations (email, full_name) values ('nuovo.invito@liceovoltacomo.edu.it', 'Nuovo') on conflict (email) do update set created_at = now()");
  check("sicurezza: invito docente recente accettato", (await fails("insert into auth.users (email, raw_app_meta_data) values ('nuovo.invito@liceovoltacomo.edu.it', '{\"provider\":\"email\"}')")) === null);

  // diritto di accesso
  const owner = many[3];
  await asUser(owner);
  const exp = (await db.query<{ e: { profilo: { email: string }; prenotazioni: unknown[] } }>("select public.export_my_data() e")).rows[0].e;
  await asSystem();
  const ownBookings = (await db.query<{ n: number }>("select count(*)::int n from public.bookings where student_id = $1", [owner])).rows[0].n;
  check("privacy: lo studente scarica i propri dati (profilo e prenotazioni)", Boolean(exp.profilo.email) && exp.prenotazioni.length === ownBookings && ownBookings > 0, `${exp.prenotazioni.length}/${ownBookings}`);
  await asUser(teacher);
  check("privacy: l'esportazione personale è solo per gli studenti", (await fails("select public.export_my_data()")) !== null);
  await asUser(null);
  check("privacy: esportazione negata ai visitatori anonimi", (await fails("select public.export_my_data()")) !== null);

  // diritto alla cancellazione
  await asUser(owner);
  check("sicurezza: uno studente non può cancellare profili", (await fails("select public.erase_student($1)", [many[4]])) !== null);
  await asUser(teacher);
  check("sicurezza: neppure un docente può usare la cancellazione definitiva", (await fails("select public.erase_student($1)", [many[4]])) !== null);
  check("sicurezza: la pulizia dei dati è riservata al server", (await fails("select public.purge_expired_data()")) !== null);
  await asSystem();
  const victimEmail = (await db.query<{ e: string }>("select email e from public.students where id = $1", [owner])).rows[0].e;
  await db.query("select public.erase_student($1)", [owner]);
  const left = (await db.query<{ s: number; b: number; w: number; a: number }>(`select
      (select count(*)::int from public.students where id = $1) s,
      (select count(*)::int from public.bookings where student_id = $1) b,
      (select count(*)::int from public.waitlist_entries where student_id = $1) w,
      (select count(*)::int from public.audit_log where details::text like '%' || $2 || '%' or actor_id = $1) a`, [owner, victimEmail])).rows[0];
  check("privacy: cancellazione su richiesta: profilo, prenotazioni e liste eliminati", left.s === 0 && left.b === 0 && left.w === 0, JSON.stringify(left));
  check("privacy: cancellazione su richiesta: nessuna traccia nel registro", left.a === 0);

  // conservazione: simulazione di una data futura (giugno 2028)
  await db.query("insert into public.auth_attempts (kind, email, succeeded, created_at) values ('teacher_login', 'x@liceovoltacomo.edu.it', false, now() - interval '40 days'), ('teacher_login', 'y@liceovoltacomo.edu.it', true, now())");
  await db.query("update public.notification_outbox set status = 'sent', created_at = now() - interval '40 days' where id = (select min(id) from public.notification_outbox)");
  await db.query("insert into public.audit_log (action, entity_type, occurred_at) values ('prova.vecchia', 'x', now() - interval '25 months')");
  const ghost = await newUser("diplomato.2025@stud.liceovoltacomo.edu.it", google, verified);
  await db.query("update public.students set created_at = now() - interval '14 months' where id = $1", [ghost]);
  const bBefore = (await db.query<{ n: number }>("select count(*)::int n from public.bookings")).rows[0].n;
  await db.query("create or replace function public.school_today() returns date language sql stable set search_path = '' as $$ select date '2028-06-15' $$");
  const purge = (await db.query<{ r: Record<string, number> }>("select public.purge_expired_data() r")).rows[0].r;
  await db.query("create or replace function public.school_today() returns date language sql stable set search_path = '' as $$ select (now() at time zone (select s.school_timezone from public.app_settings s where s.id = 1))::date $$");
  const pAfter = (await db.query<{ b: number; w: number; att: number; old: number; g: number }>(`select
      (select count(*)::int from public.bookings) b, (select count(*)::int from public.waitlist_entries) w,
      (select count(*)::int from public.auth_attempts where email in ('x@liceovoltacomo.edu.it', 'y@liceovoltacomo.edu.it')) att,
      (select count(*)::int from public.audit_log where action = 'prova.vecchia') old,
      (select count(*)::int from public.students where id = $1) g`, [ghost])).rows[0];
  check("conservazione: prenotazioni e liste oltre 12 mesi cancellate", bBefore > 0 && pAfter.b === 0 && pAfter.w === 0 && purge.prenotazioni === bBefore, JSON.stringify(purge));
  check("conservazione: tentativi di accesso oltre 30 giorni cancellati (i recenti restano)", pAfter.att === 1);
  check("conservazione: coda email oltre 30 giorni cancellata", purge.email_in_coda >= 1);
  check("conservazione: registro oltre 24 mesi cancellato", pAfter.old === 0);
  check("conservazione: profili inattivi da oltre 12 mesi cancellati", pAfter.g === 0 && purge.profili_inattivi >= 1);
  check("conservazione: l'operazione è registrata senza dati personali", (await db.query<{ n: number }>("select count(*)::int n from public.audit_log where action = 'privacy.conservazione'")).rows[0].n === 1);
  check("conservazione: le giornate del calendario restano", (await db.query<{ n: number }>("select count(*)::int n from public.school_days")).rows[0].n >= 145);

  return report();

  async function newUserAsSystem(email: string) {
    await asSystem();
    return newUser(email, { provider: "google" }, { email_verified: true });
  }
}

function report() {
  const failed = results.filter((r) => !r.ok);
  for (const r of results) {
    console.log(`${r.ok ? "✔" : "✘"} ${r.name}${!r.ok && r.detail ? `  →  ${r.detail}` : ""}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} verifiche superate`);
  // uscita dopo lo svuotamento dell'output (con una pipe process.exit può troncarlo)
  process.stdout.write("", () => process.exit(failed.length ? 1 : 0));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
