/**
 * BIBLIOVOLTA · Verifica di sicurezza e privacy (Fase 7)
 *
 *   npm run test:security        (Linux, root: come test:auth)
 *
 * Attacca l'app reale (build di produzione + stack Supabase locale) come
 * farebbe un visitatore o uno studente malintenzionato: dominio Google,
 * sessioni, intestazioni HTTP, separazione dei ruoli, API dirette del
 * database tabella per tabella, funzioni riservate, link della lista
 * d'attesa, chiavi segrete nei file inviati al browser, informativa e
 * diritto di accesso ai propri dati.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { GOOGLE_TEST_CLIENT, startStack } from "./local-stack/stack.mjs";
import { startMockGoogle } from "./local-stack/mock-google.mjs";
import { startMockResend } from "./local-stack/mock-resend.mjs";

const ROOT = process.cwd();
const APP = "http://localhost:3400";
const OUT = join(ROOT, ".local-stack", "screens-security");
const CRON_SECRET = "test-cron-secret-0123456789abcdef";
const results = [];
const check = (group, name, ok, detail = "") => {
  results.push({ group, name, ok: Boolean(ok), detail });
  console.log(`${ok ? "✔" : "✘"} [${group}] ${name}${!ok && detail ? `  →  ${detail}` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (cmd, args, env) =>
  new Promise((ok, ko) => spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: "ignore" }).on("exit", (c) => (c === 0 ? ok() : ko(new Error(`${cmd} ${c}`)))));
const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));

async function main() {
  mkdirSync(OUT, { recursive: true });
  const google = await startMockGoogle({ dir: join(ROOT, ".local-stack", "mock-google"), clientId: GOOGLE_TEST_CLIENT.id, clientSecret: GOOGLE_TEST_CLIENT.secret });
  const mail = await startMockResend();
  const stack = await startStack({ fresh: true, googleCaBundle: google.caBundle });
  const env = {
    ...stack.env,
    NEXT_DIST_DIR: ".next-test",
    NEXT_TELEMETRY_DISABLED: "1",
    RESEND_API_KEY: "re_test_key",
    RESEND_BASE_URL: mail.url,
    EMAIL_FROM: "BIBLIOVOLTA <bibliovolta@liceovoltacomo.edu.it>",
    CRON_SECRET,
  };
  const db = stack.db;
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
  let server;
  let browser;
  try {
    if (!process.argv.includes("--no-build") || !existsSync(join(ROOT, ".next-test"))) {
      console.log("Compilo l'app per il test…");
      await run("npx", ["next", "build"], env);
    }
    if (await fetch(APP).then(() => true, () => false)) throw new Error("La porta 3400 è occupata.");
    server = spawn(join(ROOT, "node_modules", ".bin", "next"), ["start", "-p", "3400"], { cwd: ROOT, env: { ...process.env, ...env }, stdio: process.env.APP_LOG ? "inherit" : "ignore", detached: true });
    for (let i = 0; i < 120 && !(await fetch(APP).then(() => true, () => false)); i++) await sleep(500);

    const API = stack.env.NEXT_PUBLIC_SUPABASE_URL;
    const ANON = stack.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const tokenFor = (id) => stack.sign({ sub: id, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 });
    const rest = (token, path, init = {}) =>
      fetch(`${API}/rest/v1/${path}`, { ...init, headers: { apikey: ANON, authorization: `Bearer ${token ?? ANON}`, "content-type": "application/json", prefer: "return=representation", ...(init.headers ?? {}) } });
    const rows = async (token, path) => {
      const r = await rest(token, path);
      if (r.status >= 400) return { denied: true, rows: [] };
      return { denied: false, rows: await r.json() };
    };
    const rpc = (token, fn, body = {}) => rest(token, `rpc/${fn}`, { method: "POST", body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

    // ---------------- dati ----------------
    let seq = 0;
    const student = async (first, last, klass) => {
      const email = `${first}.${last}${seq++}`.toLowerCase() + "@stud.liceovoltacomo.edu.it";
      const r = await db.query(
        `insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
         values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', $1,
                 '{"provider":"google","providers":["google"]}', '{"email_verified":true}', now(), now(), now()) returning id`, [email]);
      await db.query("update public.students set first_name = $2, last_name = $3, class_name = $4, registered_at = now() where id = $1", [r.rows[0].id, first, last, klass]);
      return { id: r.rows[0].id, email };
    };
    const dayId = async (d) => (await one("select id from public.school_days where day = $1", [d])).id;
    const A = await student("Anna", "Alfa", "4A");
    const B = await student("Bruno", "Beta", "5B");
    const D1 = "2026-11-26";
    await rpc(tokenFor(A.id), "book_seat", { p_school_day_id: await dayId(D1) });
    await rpc(tokenFor(B.id), "book_seat", { p_school_day_id: await dayId(D1) });
    const bookingB = (await one("select id from public.bookings where student_id = $1", [B.id])).id;
    const admin = createClient(API, stack.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    await admin.from("teacher_invitations").upsert({ email: "anna.rossi@liceovoltacomo.edu.it", full_name: "Anna Rossi", is_admin: true });
    const t = await admin.auth.admin.createUser({ email: "anna.rossi@liceovoltacomo.edu.it", password: stack.env.TEACHER_INITIAL_PASSWORD, email_confirm: true });
    const teacherId = t.data.user.id;
    await db.query("update public.teachers set must_change_password = false where id = $1", [teacherId]);
    // una comunicazione con esito, per avere righe in tutte le tabelle
    await rpc(tokenFor(teacherId), "send_announcement", { p_school_day_id: await dayId(D1), p_include_bookings: true, p_include_waitlist: false, p_subject: "Avviso di prova", p_body: "Testo di prova per i prenotati", p_category: "altro" });
    await fetch(`${APP}/api/cron/notifications`, { headers: { authorization: `Bearer ${CRON_SECRET}` } });

    browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
      args: ["--no-sandbox", "--no-proxy-server", "--host-resolver-rules=MAP accounts.google.com 127.0.0.1, MAP *.googleapis.com 127.0.0.1"],
    });
    const ctxOpts = { ignoreHTTPSErrors: true, reducedMotion: "reduce", locale: "it-IT", timezoneId: "Europe/Rome", acceptDownloads: true };

    // =====================================================================
    // 1. Dominio Google scolastico
    // =====================================================================
    const tryGoogle = async (account) => {
      const ctx = await browser.newContext(ctxOpts);
      const page = await ctx.newPage();
      google.useAccount(account);
      await page.goto(`${APP}/accesso`);
      await page.getByRole("button", { name: "Accedi con Google" }).click();
      await page.waitForURL((u) => {
        const x = new URL(u);
        return ["/registrazione", "/studente"].includes(x.pathname) || (x.pathname === "/accesso" && x.searchParams.has("errore"));
      }, { timeout: 20000 }).catch(() => {});
      await page.waitForLoadState("networkidle").catch(() => {});
      if (process.env.DEBUG_SEC) console.log("   →", page.url());
      return { ctx, page, path: new URL(page.url()).pathname, cookies: (await ctx.cookies()).filter((c) => /-auth-token(\.\d+)?$/.test(c.name)) };
    };
    const exists = async (email) => (await one("select count(*)::int n from auth.users where email = $1", [email])).n > 0;
    for (const [label, acc] of [
      ["account Gmail personale", { email: "mario.rossi@gmail.com", email_verified: true, name: "Mario Rossi" }],
      ["dominio dei docenti", { email: "prof.bianchi@liceovoltacomo.edu.it", email_verified: true, name: "Prof Bianchi" }],
      ["dominio simile ma falso", { email: "luca@stud.liceovoltacomo.edu.it.evil.com", email_verified: true, name: "Luca" }],
      ["email scolastica non verificata", { email: "non.verificato@stud.liceovoltacomo.edu.it", email_verified: false, name: "Non Verificato" }],
    ]) {
      const r = await tryGoogle(acc);
      check("1 · Dominio Google", `${label}: rifiutato, nessun account, nessuna sessione`, r.path === "/accesso" && !(await exists(acc.email)) && r.cookies.length === 0, `${r.path} ${r.cookies.length}`);
      await r.ctx.close();
    }
    const good = await tryGoogle({ email: "giulia.verdi@stud.liceovoltacomo.edu.it", email_verified: true, name: "Giulia Verdi", given_name: "Giulia", family_name: "Verdi", hd: "stud.liceovoltacomo.edu.it" });
    check("1 · Dominio Google", "account @stud.liceovoltacomo.edu.it accettato", good.path === "/registrazione", good.path);

    // =====================================================================
    // 2. Sessioni
    // =====================================================================
    const page = good.page;
    check("2 · Sessioni", "cookie di sessione httpOnly e SameSite=Lax", good.cookies.length > 0 && good.cookies.every((c) => c.httpOnly && c.sameSite === "Lax"));
    check("2 · Sessioni", "nessun token leggibile da JavaScript (cookie, localStorage, sessionStorage)", await page.evaluate(() => !document.cookie.includes("auth-token") && !JSON.stringify(localStorage).includes("access_token") && !JSON.stringify(sessionStorage).includes("access_token")));
    await page.selectOption("#reg-year", "3");
    await page.fill("#reg-section", "C");
    await page.getByRole("button", { name: /Completa la registrazione/ }).click();
    await page.waitForURL(`${APP}/studente`, { timeout: 20000 });
    const giulia = await one("select id from public.students where email = 'giulia.verdi@stud.liceovoltacomo.edu.it'");
    const meta = await one("select raw_user_meta_data m from auth.users where id = $1", [giulia.id]);
    const ident = await one("select identity_data d from auth.identities where user_id = $1", [giulia.id]);
    check("8 · Privacy", "la foto del profilo Google non viene conservata (utente e identità)", !("picture" in meta.m) && !("picture" in (ident?.d ?? {})), JSON.stringify(meta.m));
    const cookieJar = await good.ctx.cookies();
    // logout e riuso dei vecchi cookie
    await page.getByRole("button", { name: "Esci" }).first().click();
    await page.waitForURL((u) => new URL(u).pathname === "/accesso" || new URL(u).pathname === "/", { timeout: 15000 });
    const replay = await browser.newContext(ctxOpts);
    await replay.addCookies(cookieJar);
    const rp = await replay.newPage();
    await rp.goto(`${APP}/studente`);
    check("2 · Sessioni", "dopo l'uscita i vecchi cookie copiati non riaprono la sessione", new URL(rp.url()).pathname === "/accesso", rp.url());
    await replay.close();
    const forged = stack.sign({ sub: giulia.id, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 }).replace(/.$/, "x");
    const forgedRes = await rest(forged, "students?select=email");
    check("2 · Sessioni", "token con firma alterata rifiutato dal database", forgedRes.status === 401, String(forgedRes.status));
    const expired = stack.sign({ sub: A.id, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) - 60 });
    check("2 · Sessioni", "token scaduto rifiutato dal database", (await rest(expired, "students?select=email")).status === 401);

    // =====================================================================
    // 3. Intestazioni HTTP
    // =====================================================================
    const home = await fetch(APP);
    const h = (k) => home.headers.get(k) ?? "";
    const csp = h("content-security-policy");
    check("3 · Intestazioni", "Content-Security-Policy restrittiva (default-src 'self', frame-ancestors 'none', object-src 'none')", csp.includes("default-src 'self'") && csp.includes("frame-ancestors 'none'") && csp.includes("object-src 'none'") && !csp.includes("unsafe-eval"), csp);
    check("3 · Intestazioni", "HSTS, nosniff, X-Frame-Options DENY, Referrer-Policy", h("strict-transport-security").includes("max-age=63072000") && h("x-content-type-options") === "nosniff" && h("x-frame-options") === "DENY" && h("referrer-policy") === "strict-origin-when-cross-origin");
    check("3 · Intestazioni", "nessuna intestazione X-Powered-By", !home.headers.has("x-powered-by"));
    const cspCtx = await browser.newContext(ctxOpts);
    const cspPage = await cspCtx.newPage();
    const violations = [];
    cspPage.on("console", (m) => /Content Security Policy|Refused to/i.test(m.text()) && violations.push(m.text()));
    for (const p of ["/", "/accesso", "/accesso/docenti"]) await cspPage.goto(`${APP}${p}`, { waitUntil: "networkidle" });
    check("3 · Intestazioni", "nessuna violazione CSP nelle pagine pubbliche", violations.length === 0, violations.join(" | ").slice(0, 300));
    await cspCtx.close();

    // =====================================================================
    // 4. Separazione dei permessi
    // =====================================================================
    const tokA = tokenFor(A.id);
    const tokT = tokenFor(teacherId);
    const teacherOnly = [
      ["teacher_update_day", { p_school_day_id: await dayId(D1), p_is_open: false, p_capacity: 50, p_opens_at: "14:15", p_closes_at: "16:30", p_note: null, p_closure_reason: "x" }],
      ["teacher_cancel_booking", { p_booking_id: bookingB, p_reason: "prova" }],
      ["send_announcement", { p_school_day_id: await dayId(D1), p_include_bookings: true, p_include_waitlist: false, p_subject: "Ciao", p_body: "Messaggio falso", p_category: "altro" }],
      ["teacher_stats", {}],
      ["set_opening_hours", { p_opens_at: "08:00", p_closes_at: "09:00" }],
      ["set_offer_minutes", { p_minutes: 15 }],
      ["announcement_recipients_count", { p_school_day_id: await dayId(D1), p_include_bookings: true, p_include_waitlist: true }],
    ];
    let denied = 0;
    for (const [fn, body] of teacherOnly) if ((await rpc(tokA, fn, body)).status >= 400) denied++;
    check("4 · Permessi", `uno studente non può usare nessuna delle ${teacherOnly.length} funzioni dei docenti`, denied === teacherOnly.length, `${denied}/${teacherOnly.length}`);
    const serverOnly = ["claim_notifications", "purge_expired_data", "erase_student", "run_waitlist_maintenance", "complete_notification", "process_day_waitlist", "log_teacher_action", "create_day_announcement"];
    let sDenied = 0;
    for (const fn of serverOnly) {
      const a = await rpc(tokA, fn, fn === "erase_student" ? { p_student_id: B.id } : fn === "claim_notifications" ? { p_limit: 5 } : {});
      const b = await rpc(tokT, fn, fn === "erase_student" ? { p_student_id: B.id } : fn === "claim_notifications" ? { p_limit: 5 } : {});
      const c = await rpc(null, fn, {});
      if (a.status >= 400 && b.status >= 400 && c.status >= 400) sDenied++;
    }
    check("4 · Permessi", `le ${serverOnly.length} funzioni interne (email, pulizia, cancellazione) sono negate a studenti, docenti e anonimi`, sDenied === serverOnly.length, `${sDenied}/${serverOnly.length}`);
    check("4 · Permessi", "B esiste ancora dopo i tentativi di cancellazione", (await one("select count(*)::int n from public.students where id = $1", [B.id])).n === 1);
    const cancelOther = await rpc(tokA, "cancel_booking", { p_booking_id: bookingB });
    check("4 · Permessi", "uno studente non può annullare la prenotazione di un altro", cancelOther.status >= 400 && (await one("select status from public.bookings where id = $1", [bookingB])).status === "confirmed");

    // pagine e route per ruolo
    const sCtx = await browser.newContext(ctxOpts);
    const sPage = await sCtx.newPage();
    google.useAccount({ email: "giulia.verdi@stud.liceovoltacomo.edu.it", email_verified: true, name: "Giulia Verdi" });
    await sPage.goto(`${APP}/accesso`);
    await sPage.getByRole("button", { name: "Accedi con Google" }).click();
    await sPage.waitForURL(`${APP}/studente`, { timeout: 20000 });
    for (const path of ["/docenti", "/docenti/iscritti", "/docenti/registro", "/docenti/comunicazioni"]) await sPage.goto(`${APP}${path}`);
    check("4 · Permessi", "uno studente non apre le pagine dei docenti", new URL(sPage.url()).pathname === "/studente");
    const sExport = await sPage.request.get(`${APP}/docenti/iscritti/esporta?giorno=${D1}&formato=csv`, { maxRedirects: 0 });
    check("4 · Permessi", "uno studente non scarica l'elenco degli iscritti", sExport.status() === 307 || sExport.status() === 403, String(sExport.status()));
    const anonExport = await fetch(`${APP}/docenti/iscritti/esporta?giorno=${D1}&formato=xlsx`, { redirect: "manual" });
    const anonData = await fetch(`${APP}/studente/i-miei-dati`, { redirect: "manual" });
    check("4 · Permessi", "senza accesso nessun export (iscritti, dati personali)", [307, 403].includes(anonExport.status) && [307, 403].includes(anonData.status));

    // =====================================================================
    // 5. API e automazioni
    // =====================================================================
    check("5 · API", "cron senza segreto → 401", (await fetch(`${APP}/api/cron/notifications`)).status === 401);
    check("5 · API", "cron con segreto sbagliato → 401", (await fetch(`${APP}/api/cron/notifications`, { headers: { authorization: "Bearer " + "x".repeat(CRON_SECRET.length) } })).status === 401);
    check("5 · API", "/api/me senza accesso → 401", (await fetch(`${APP}/api/me`)).status === 401);
    const signup = await fetch(`${API}/auth/v1/signup`, { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ email: "intruso@liceovoltacomo.edu.it", password: "Password12345" }) });
    check("5 · API", "registrazione email/password dall'esterno rifiutata (solo docenti invitati)", signup.status >= 400 && !(await exists("intruso@liceovoltacomo.edu.it")), String(signup.status));
    await db.query("insert into public.teacher_invitations (email, full_name, created_at) values ('vecchio.invito@liceovoltacomo.edu.it', 'X', now() - interval '1 hour')");
    const late = await fetch(`${API}/auth/v1/signup`, { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ email: "vecchio.invito@liceovoltacomo.edu.it", password: "Password12345" }) });
    check("5 · API", "un invito docente scaduto non può essere sfruttato da altri", late.status >= 400 && !(await exists("vecchio.invito@liceovoltacomo.edu.it")));
    const pw = await one("select encrypted_password p from auth.users where id = $1", [teacherId]);
    check("6 · Password e chiavi", "password dei docenti salvate solo come hash bcrypt", /^\$2[aby]\$\d{2}\$/.test(pw.p) && !pw.p.includes(stack.env.TEACHER_INITIAL_PASSWORD));

    // =====================================================================
    // 6. Database: ogni tabella, letta da anonimo e da studente
    // =====================================================================
    const tables = ["students", "teachers", "bookings", "waitlist_entries", "seat_offers", "announcements", "announcement_deliveries", "audit_log", "notification_outbox", "auth_attempts", "teacher_invitations"];
    const anonLeaks = [];
    for (const tb of tables) {
      const r = await rows(null, `${tb}?select=*`);
      if (!r.denied && r.rows.length) anonLeaks.push(tb);
    }
    check("7 · Database", `un visitatore anonimo non legge nessuna delle ${tables.length} tabelle con dati`, anonLeaks.length === 0, anonLeaks.join(","));
    const own = { students: "id", bookings: "student_id", waitlist_entries: "student_id", seat_offers: "student_id", announcement_deliveries: "student_id" };
    const leaks = [];
    for (const tb of tables) {
      const r = await rows(tokA, `${tb}?select=*`);
      if (r.denied) continue;
      if (own[tb]) {
        if (r.rows.some((x) => x[own[tb]] !== A.id)) leaks.push(tb);
      } else if (tb === "announcements") {
        // solo le comunicazioni ricevute
        const mine = (await db.query("select announcement_id from public.announcement_deliveries where student_id = $1", [A.id])).rows.map((x) => x.announcement_id);
        if (r.rows.some((x) => !mine.includes(x.id) && x.audience !== "all_students")) leaks.push(tb);
      } else if (r.rows.length) leaks.push(tb);
    }
    check("7 · Database", "uno studente legge solo le proprie righe (profilo, prenotazioni, liste, proposte, comunicazioni)", leaks.length === 0, leaks.join(","));
    const bRows = await rows(tokA, `bookings?select=id&student_id=eq.${B.id}`);
    check("7 · Database", "filtrare per l'id di un altro studente non restituisce nulla", bRows.rows.length === 0);
    const avail = await rpc(tokA, "get_day_availability", { p_from: D1, p_to: D1 });
    check("7 · Database", "il calendario degli studenti mostra solo numeri, nessun nome o email", avail.status === 200 && !JSON.stringify(avail.body).includes("@") && avail.body[0]?.booked === 2, JSON.stringify(avail.body).slice(0, 160));
    check("7 · Database", "senza accesso nemmeno la disponibilità è leggibile", (await rpc(null, "get_day_availability", { p_from: D1, p_to: D1 })).status >= 400);
    const ins = await rest(tokA, "bookings", { method: "POST", body: JSON.stringify({ student_id: B.id, school_day_id: await dayId("2026-11-27") }) });
    check("7 · Database", "inserimento diretto di prenotazioni a nome altrui rifiutato", ins.status >= 400);
    const upd = await rest(tokA, `bookings?id=eq.${bookingB}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) });
    check("7 · Database", "modifica diretta di prenotazioni altrui impossibile", (upd.status >= 400 || JSON.stringify(await upd.json()) === "[]") && (await one("select status from public.bookings where id = $1", [bookingB])).status === "confirmed");
    const promote = await rest(tokA, `students?id=eq.${A.id}`, { method: "PATCH", body: JSON.stringify({ email: "x@liceovoltacomo.edu.it" }) });
    check("7 · Database", "uno studente non può cambiare la propria email o diventare docente", (promote.status >= 400 || JSON.stringify(await promote.json()) === "[]") && (await one("select email from public.students where id = $1", [A.id])).email === A.email);
    const delSchool = await rest(tokA, `school_days?day=eq.2026-11-27`, { method: "PATCH", body: JSON.stringify({ is_open: false }) });
    check("7 · Database", "uno studente non può chiudere giornate scrivendo nel database", (delSchool.status >= 400 || JSON.stringify(await delSchool.json()) === "[]") && (await one("select is_open from public.school_days where day = '2026-11-27'")).is_open === true);
    // _local_migrations esiste solo nello stack di prova (registro delle migrazioni applicate)
    const rlsOff = await one("select count(*)::int n, string_agg(tablename, ',') t from pg_tables where schemaname = 'public' and not rowsecurity and tablename <> '_local_migrations'");
    check("7 · Database", "Row Level Security attiva su tutte le tabelle", rlsOff.n === 0, rlsOff.t ?? "");
    const definer = await one(`select count(*)::int n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`);
    check("7 · Database", "tutte le funzioni privilegiate hanno search_path fisso", definer.n === 0, String(definer.n));
    const auditPii = await one("select count(*)::int n from public.audit_log where action not like 'docente.%' and details::text ~ '@stud\\.liceovoltacomo'");
    check("8 · Privacy", "il registro tecnico non contiene email degli studenti", auditPii.n === 0, String(auditPii.n));

    // =====================================================================
    // 7. Link della lista d'attesa
    // =====================================================================
    const D2 = "2026-11-30";
    const fill = [];
    for (let i = 0; i < 50; i++) fill.push((await student("Pieno", `P${i}`, "2A")).id);
    await db.query("insert into public.bookings (student_id, school_day_id, created_by) select unnest($1::uuid[]), $2, unnest($1::uuid[])", [fill, await dayId(D2)]);
    await rpc(tokA, "join_waitlist", { p_school_day_id: await dayId(D2) });
    const fb = (await one("select id from public.bookings where student_id = $1", [fill[0]])).id;
    await rpc(tokenFor(fill[0]), "cancel_booking", { p_booking_id: fb });
    await fetch(`${APP}/api/cron/notifications`, { headers: { authorization: `Bearer ${CRON_SECRET}` } });
    const offerMail = await mail.waitFor(A.email, "Si è liberato un posto");
    const token = offerMail?.html.match(/\/proposta\/([0-9a-f]{64})/)?.[1];
    check("9 · Link lista d'attesa", "link personale con 256 bit esadecimali (64 caratteri)", Boolean(token) && /^[0-9a-f]{64}$/.test(token));
    check("9 · Link lista d'attesa", "nel database solo l'impronta SHA-256, mai il link in chiaro", (await one("select count(*)::int n from public.seat_offers where token_hash = $1", [token])).n === 0 && (await one("select count(*)::int n from public.notification_outbox where payload::text like '%' || $1 || '%'", [token])).n === 0);
    const lctx = await browser.newContext(ctxOpts);
    const lp = await lctx.newPage();
    await lp.goto(`${APP}/proposta/${"a".repeat(64)}`);
    check("9 · Link lista d'attesa", "un link inventato non vale", await lp.getByText("Link non valido").waitFor({ timeout: 15000 }).then(() => true, () => false));
    await lp.goto(`${APP}/proposta/${token}`);
    await lp.waitForLoadState("networkidle");
    check("9 · Link lista d'attesa", "aprire il link non conferma da solo (serve il pulsante)", (await one("select status from public.seat_offers where student_id = $1", [A.id])).status === "pending");
    const guesses = await Promise.all(Array.from({ length: 30 }, (_, i) => rpc(null, "accept_offer_by_token", { p_token: (i.toString(16) + token.slice(1)).slice(0, 64) })));
    check("9 · Link lista d'attesa", "il token non è usabile dall'API pubblica senza il server", guesses.every((g) => g.status >= 400));
    await lp.getByRole("button", { name: /Conferma il posto/i }).click();
    await lp.getByText("Posto confermato").first().waitFor({ timeout: 15000 }).catch(() => {});
    check("9 · Link lista d'attesa", "conferma con il pulsante: prenotazione registrata", (await one("select status from public.seat_offers where student_id = $1", [A.id])).status === "accepted");
    await lp.goto(`${APP}/proposta/${token}`);
    const reused = await lp.getByText("Posto già confermato").waitFor({ timeout: 15000 }).then(() => true, () => false);
    check("9 · Link lista d'attesa", "dopo la conferma il link non è più utilizzabile", reused);
    await lctx.close();

    // =====================================================================
    // 8. Chiavi e password fuori dal codice inviato al browser
    // =====================================================================
    const secrets = {
      "service role key": stack.env.SUPABASE_SERVICE_ROLE_KEY,
      "segreto JWT": stack.jwtSecret,
      "chiave Resend": "re_test_key",
      "segreto del cron": CRON_SECRET,
      "password iniziale docenti (prova)": stack.env.TEACHER_INITIAL_PASSWORD,
      // facoltativo: CHECK_SECRET=<password reale> npm run test:security la cerca nel codice senza scriverla nei file
      "valore indicato in CHECK_SECRET": process.env.CHECK_SECRET,
    };
    const clientFiles = walk(join(ROOT, ".next-test", "static")).filter((f) => /\.(js|css|html|json)$/.test(f));
    const htmlPages = await Promise.all(["/", "/accesso", "/accesso/docenti", "/stato"].map((p) => fetch(APP + p).then((r) => r.text())));
    const bundle = clientFiles.map((f) => readFileSync(f, "utf8")).join("\n") + htmlPages.join("\n");
    const found = Object.entries(secrets).filter(([, v]) => v && bundle.includes(v)).map(([k]) => k);
    check("6 · Password e chiavi", `nessuna chiave o password nei ${clientFiles.length} file inviati al browser`, found.length === 0, found.join(","));
    const srcFiles = walk(join(ROOT, "src")).concat(walk(join(ROOT, "supabase")));
    const srcHits = srcFiles.filter((f) => {
      const t = readFileSync(f, "utf8");
      return Object.values(secrets).some((v) => v && t.includes(v)) || /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(t) || /re_[A-Za-z0-9]{16,}/.test(t) || /sb_secret_/.test(t);
    });
    check("6 · Password e chiavi", "nessuna password o chiave scritta nel codice sorgente", srcHits.length === 0, srcHits.join(","));
    const envExample = readFileSync(join(ROOT, ".env.example"), "utf8");
    check("6 · Password e chiavi", ".env.example senza valori segreti", !/=(eyJ|re_|sb_secret)/.test(envExample) && !Object.values(secrets).some((v) => v && envExample.includes(v)));
    check("6 · Password e chiavi", ".env* esclusi dal versionamento", /^\.env\*$/m.test(readFileSync(join(ROOT, ".gitignore"), "utf8")));

    // =====================================================================
    // 9. Privacy: informativa e diritto di accesso
    // =====================================================================
    const pr = await fetch(`${APP}/privacy`, { redirect: "manual" });
    check("8 · Privacy", "/privacy rimanda all'informativa ufficiale della scuola", [307, 308].includes(pr.status) && pr.headers.get("location") === "https://liceovoltacomo.edu.it/privacy-policy/", `${pr.status} ${pr.headers.get("location")}`);
    const home2 = await (await fetch(`${APP}/accesso`)).text();
    check("8 · Privacy", "informativa ufficiale raggiungibile dalla pagina di accesso", home2.includes('href="https://liceovoltacomo.edu.it/privacy-policy/"'));
    await sPage.goto(`${APP}/studente`);
    const [dl] = await Promise.all([sPage.waitForEvent("download"), sPage.getByRole("link", { name: "Scarica i miei dati" }).click()]);
    const file = join(OUT, dl.suggestedFilename());
    await dl.saveAs(file);
    const mine = JSON.parse(readFileSync(file, "utf8"));
    check("8 · Privacy", "lo studente scarica i propri dati in un file", mine.profilo?.email === "giulia.verdi@stud.liceovoltacomo.edu.it" && Array.isArray(mine.prenotazioni));
    const dump = JSON.stringify(mine);
    check("8 · Privacy", "il file non contiene dati di altri studenti", !dump.includes(A.email) && !dump.includes(B.email));
    const cookieNames = (await sCtx.cookies()).map((c) => c.name);
    check("8 · Privacy", "solo cookie tecnici (sessione), nessun cookie di terze parti", cookieNames.every((n) => /^sb-.*-auth-token(\.\d+)?$/.test(n) || /^sb-.*code-verifier/.test(n)), cookieNames.join(","));
    await sCtx.close();
  } finally {
    await browser?.close().catch(() => {});
    if (server?.pid) {
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {}
    }
    await stack.stop();
    await google.stop();
    await mail.stop();
  }
  const failed = results.filter((r) => !r.ok);
  writeFileSync(join(OUT, "risultati.json"), JSON.stringify(results, null, 2));
  console.log(`\n${results.length - failed.length}/${results.length} verifiche superate`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
