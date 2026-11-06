/**
 * BIBLIOVOLTA · Test end-to-end della lista d'attesa automatica (Fase 5)
 *
 *   npm run test:waitlist        (Linux, root: come test:auth)
 *
 * Stack Supabase locale reale, app Next.js compilata, Chrome, server
 * email di prova al posto di Resend. Il passare del tempo (2 ore, soglia
 * delle 24 ore) si simula spostando le scadenze nel database; la
 * manutenzione automatica è eseguita chiamando /api/cron/notifications
 * come fanno Supabase Cron / Vercel Cron, senza browser aperti.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { chromium } from "playwright";
import { GOOGLE_TEST_CLIENT, startStack } from "./local-stack/stack.mjs";
import { startMockGoogle } from "./local-stack/mock-google.mjs";
import { startMockResend } from "./local-stack/mock-resend.mjs";

const ROOT = process.cwd();
const APP = "http://localhost:3400";
const SHOTS = join(ROOT, ".local-stack", "screens-waitlist");
const CRON_SECRET = "test-cron-secret-0123456789abcdef";
const results = [];
const check = (group, name, ok, detail = "") => {
  results.push({ group, name, ok: Boolean(ok), detail });
  console.log(`${ok ? "✔" : "✘"} [${group}] ${name}${!ok && detail ? `  →  ${detail}` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (cmd, args, env) =>
  new Promise((ok, ko) => spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: "ignore" }).on("exit", (c) => (c === 0 ? ok() : ko(new Error(`${cmd} ${c}`)))));

async function main() {
  mkdirSync(SHOTS, { recursive: true });
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
  const pool = new pg.Pool({ host: "127.0.0.1", port: stack.ports.pg, user: "postgres", password: "postgres", database: "postgres", max: 30 });
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

    // ---------------- utilità ----------------
    const dayId = async (d) => (await db.query("select id from public.school_days where day = $1", [d])).rows[0].id;
    let seq = 0;
    const createStudents = async (n, prefix) => {
      const ids = [];
      for (let i = 0; i < n; i++) {
        const email = `${prefix}${seq++}@stud.liceovoltacomo.edu.it`;
        const r = await db.query(
          `insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
           values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', $1,
                   '{"provider":"google","providers":["google"]}', '{"email_verified":true}', now(), now(), now()) returning id`, [email]);
        ids.push(r.rows[0].id);
      }
      await db.query("update public.students set first_name = 'Prova', last_name = 'N' || substr(id::text, 1, 4), class_name = '3A', registered_at = now() where id = any($1)", [ids]);
      return ids;
    };
    const fill = async (date, n) => {
      const ids = await createStudents(n, `pieno${date.replaceAll("-", "")}x`);
      await db.query("insert into public.bookings (student_id, school_day_id, created_by) select unnest($1::uuid[]), $2, unnest($1::uuid[])", [ids, await dayId(date)]);
      return ids;
    };
    const confirmed = async (date) => (await db.query("select count(*)::int n from public.bookings b join public.school_days d on d.id = b.school_day_id where d.day = $1 and b.status = 'confirmed'", [date])).rows[0].n;
    const pendingOffers = async (date) => (await db.query("select count(*)::int n from public.seat_offers o join public.school_days d on d.id = o.school_day_id where d.day = $1 and o.status = 'pending'", [date])).rows[0].n;
    const tokenFor = (id) => stack.sign({ sub: id, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 });
    const rpc = (token, fn, body) =>
      fetch(`${stack.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers: { apikey: stack.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
    const service = (fn, body) => rpc(stack.env.SUPABASE_SERVICE_ROLE_KEY, fn, body);
    const cancelOf = async (studentId, date) => {
      const b = (await db.query("select b.id from public.bookings b join public.school_days d on d.id = b.school_day_id where b.student_id = $1 and d.day = $2 and b.status = 'confirmed'", [studentId, date])).rows[0];
      return rpc(tokenFor(studentId), "cancel_booking", { p_booking_id: b.id });
    };
    const cron = (secret = CRON_SECRET) => fetch(`${APP}/api/cron/notifications`, { headers: secret ? { authorization: `Bearer ${secret}` } : {} }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
    const linkIn = (msg) => msg?.html.match(/\/proposta\/([0-9a-f]{64})/)?.[1] ?? null;
    const emailOf = async (id) => (await db.query("select email from public.students where id = $1", [id])).rows[0].email;
    const expireOffersOf = (studentId) => db.query("update public.seat_offers set offered_at = now() - interval '2 hours 1 second', expires_at = now() - interval '1 second' where student_id = $1 and status = 'pending'", [studentId]);

    browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
      args: ["--no-sandbox", "--no-proxy-server", "--host-resolver-rules=MAP accounts.google.com 127.0.0.1, MAP *.googleapis.com 127.0.0.1"],
    });
    const newContext = (mobile = false) =>
      browser.newContext({ ignoreHTTPSErrors: true, reducedMotion: "reduce", ...(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 900 } }) });
    const login = async (page, account, year, section) => {
      google.useAccount(account);
      await page.goto(`${APP}/accesso`);
      await page.getByRole("button", { name: "Accedi con Google" }).click();
      await page.waitForURL(`${APP}/registrazione`, { timeout: 20000 });
      await page.selectOption("#reg-year", year);
      await page.fill("#reg-section", section);
      await page.getByRole("button", { name: /Completa la registrazione/ }).click();
      await page.waitForURL(`${APP}/studente`, { timeout: 20000 });
    };
    const openDay = async (page, date) => {
      const label = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
      for (let i = 0; i < 9; i++) {
        const cell = page.locator(`[role="gridcell"][aria-label^="${label}"]`);
        if (await cell.count()) return cell.click();
        await page.getByRole("button", { name: "Mese successivo" }).click();
      }
      throw new Error(`giornata ${date} non trovata`);
    };
    const card = (page) => page.locator("article").filter({ has: page.getByText("Giornata", { exact: true }) });
    const settle = (page, ms = 700) => page.waitForTimeout(ms);

    const D1 = "2026-11-26";
    const fillers = await fill(D1, 50);

    // =====================================================================
    // 1. Primo studente in lista
    // =====================================================================
    const gCtx = await newContext();
    const giulia = await gCtx.newPage();
    await login(giulia, { email: "giulia.verdi@stud.liceovoltacomo.edu.it", email_verified: true, name: "Giulia Verdi" }, "4", "B");
    const giuliaId = (await db.query("select id from public.students where email = 'giulia.verdi@stud.liceovoltacomo.edu.it'")).rows[0].id;
    await giulia.goto(`${APP}/studente/calendario`);
    await openDay(giulia, D1);
    await settle(giulia);
    const joinBtn = card(giulia).getByRole("button", { name: /Iscriviti alla lista d'attesa/i });
    check("1 · Primo in lista", "giornata COMPLETA: compare «ISCRIVITI ALLA LISTA D'ATTESA»", (await joinBtn.count()) === 1 && (await joinBtn.innerText()).includes("ISCRIVITI ALLA LISTA D'ATTESA"), await joinBtn.innerText().catch(() => ""));
    await giulia.screenshot({ path: join(SHOTS, "completa-iscriviti.png") });
    await joinBtn.click();
    const joined = await giulia.getByText(/Sei in lista d'attesa: posizione 1/).waitFor({ timeout: 10000 }).then(() => true, () => false);
    check("1 · Primo in lista", "iscrizione con conferma a schermo: posizione 1", joined);
    await settle(giulia);
    check("1 · Primo in lista", "la scheda mostra «Sei 1° in lista d'attesa»", (await card(giulia).innerText()).includes("Sei 1° in lista d'attesa"));
    await giulia.screenshot({ path: join(SHOTS, "in-lista.png") });
    const gEntry = (await db.query("select joined_at, queue_seq from public.waitlist_entries where student_id = $1", [giuliaId])).rows[0];
    check("1 · Primo in lista", "data e ora di iscrizione registrate", gEntry?.joined_at instanceof Date);
    const dupJoin = await rpc(tokenFor(giuliaId), "join_waitlist", { p_school_day_id: await dayId(D1) });
    check("1 · Primo in lista", "iscrizione duplicata impedita", dupJoin.status >= 400 && String(dupJoin.body?.message).includes("già in lista"));

    const mCtx = await newContext(true);
    const marco = await mCtx.newPage();
    await login(marco, { email: "marco.neri@stud.liceovoltacomo.edu.it", email_verified: true, name: "Marco Neri" }, "5", "A");
    const marcoId = (await db.query("select id from public.students where email = 'marco.neri@stud.liceovoltacomo.edu.it'")).rows[0].id;
    await marco.goto(`${APP}/studente/calendario`);
    await openDay(marco, D1);
    await settle(marco);
    await card(marco).getByRole("button", { name: /Iscriviti alla lista d'attesa/i }).click();
    check("1 · Primo in lista", "secondo studente (smartphone): posizione 2", await marco.getByText(/posizione 2/).waitFor({ timeout: 10000 }).then(() => true, () => false));
    const [luca, sara, paolo] = await createStudents(3, "attesa");
    const lj = await rpc(tokenFor(luca), "join_waitlist", { p_school_day_id: await dayId(D1) });
    const sj = await rpc(tokenFor(sara), "join_waitlist", { p_school_day_id: await dayId(D1) });
    check("1 · Primo in lista", "ordine cronologico: terzo e quarto iscritto in posizione 3 e 4", lj.body?.[0]?.queue_position === 3 && sj.body?.[0]?.queue_position === 4, JSON.stringify([lj.body, sj.body]));
    await giulia.goto(`${APP}/studente/attesa`);
    await settle(giulia);
    check("5 · Area personale", "«Le mie liste d'attesa» mostra posizione e totale", (await giulia.getByText("Sei 1° in lista su 4").count()) === 1);
    await giulia.screenshot({ path: join(SHOTS, "mie-liste.png"), fullPage: true });

    // =====================================================================
    // 2–3. Liberazione di un posto e invio della proposta
    // =====================================================================
    const c1 = await cancelOf(fillers[0], D1);
    check("2 · Posto liberato", "annullamento di una prenotazione", c1.status === 200);
    const offer1 = (await db.query("select id, status, offered_at, expires_at from public.seat_offers where student_id = $1", [giuliaId])).rows[0];
    check("2 · Posto liberato", "proposta creata subito per il primo in lista", offer1?.status === "pending");
    check("2 · Posto liberato", "tempo per confermare: 2 ore", Math.round((offer1.expires_at - offer1.offered_at) / 60000) === 120);
    check("2 · Posto liberato", "il posto resta trattenuto (49 prenotati + 1 proposto)", (await confirmed(D1)) === 49 && (await pendingOffers(D1)) === 1);
    const steal = await rpc(tokenFor(paolo), "book_seat", { p_school_day_id: await dayId(D1) });
    check("2 · Posto liberato", "nessun altro può prenotare il posto proposto", steal.status >= 400 && String(steal.body?.message).includes("numero massimo di 50"));
    check("8 · Automazione", "/api/cron/notifications senza segreto → 401", (await cron(null)).status === 401);
    const cr1 = await cron();
    check("8 · Automazione", "il cron lato server invia le email in coda", cr1.status === 200 && cr1.body?.email?.sent >= 1, JSON.stringify(cr1.body));
    const offerMail = await mail.waitFor("giulia.verdi@stud.liceovoltacomo.edu.it", "Si è liberato un posto");
    const token1 = linkIn(offerMail);
    check("3 · Invio proposta", "email al primo in lista con link personale", Boolean(token1), offerMail?.subject);
    check("3 · Invio proposta", "l'email indica la scadenza della conferma", offerMail?.html.includes("Conferma entro"));
    check("3 · Invio proposta", "il token nell'email non è salvato in chiaro nel database", (await db.query("select count(*)::int n from public.seat_offers where token_hash = $1", [token1])).rows[0].n === 0 && (await db.query("select count(*)::int n from public.notification_outbox where payload->>'token' = $1", [token1])).rows[0].n === 0);

    // =====================================================================
    // 4. Conferma entro 2 ore (dal link, anche senza aver fatto l'accesso)
    // =====================================================================
    const anonCtx = await newContext(true);
    const linkPage = await anonCtx.newPage();
    await linkPage.goto(`${APP}/proposta/${"0".repeat(64)}`);
    check("Sicurezza link", "un token inventato non è valido", (await linkPage.getByText("Link non valido").count()) === 1);
    await linkPage.goto(`${APP}/proposta/${token1}`);
    await settle(linkPage);
    check("Sicurezza link", "aprire il link non conferma da solo (serve il pulsante)", (await db.query("select status from public.seat_offers where id = $1", [offer1.id])).rows[0].status === "pending");
    await linkPage.screenshot({ path: join(SHOTS, "link-proposta.png"), fullPage: true });
    await linkPage.getByRole("button", { name: "Conferma il posto" }).click();
    check("4 · Conferma", "conferma a schermo dal link", await linkPage.getByText("Posto confermato").waitFor({ timeout: 10000 }).then(() => true, () => false));
    await linkPage.screenshot({ path: join(SHOTS, "link-confermato.png"), fullPage: true });
    const gb = (await db.query("select b.source, w.status from public.bookings b join public.waitlist_entries w on w.student_id = b.student_id and w.school_day_id = b.school_day_id where b.student_id = $1 and b.status = 'confirmed'", [giuliaId])).rows[0];
    check("4 · Conferma", "prenotazione registrata e studente tolto dalla lista", gb?.source === "waitlist_offer" && gb?.status === "assigned", JSON.stringify(gb));
    check("4 · Conferma", "50 prenotazioni, nessun posto trattenuto", (await confirmed(D1)) === 50 && (await pendingOffers(D1)) === 0);
    check("4 · Conferma", "email di conferma inviata", Boolean(await mail.waitFor("giulia.verdi@stud.liceovoltacomo.edu.it", "Posto confermato")));
    await linkPage.reload();
    check("Sicurezza link", "il link è utilizzabile una sola volta", (await linkPage.getByText("Posto già confermato").count()) === 1 && (await linkPage.getByRole("button", { name: "Conferma il posto" }).count()) === 0);
    const reuse = await service("accept_offer_by_token", { p_token: token1 });
    check("Sicurezza link", "anche dal server il token usato è rifiutato", reuse.status >= 400);
    const studentToken = await rpc(tokenFor(paolo), "accept_offer_by_token", { p_token: token1 });
    check("Sicurezza link", "gli studenti non possono chiamare la conferma via token", studentToken.status >= 400);

    // =====================================================================
    // 5–6. Mancata conferma e passaggio al successivo
    // =====================================================================
    await cancelOf(fillers[1], D1);
    await cron();
    const marcoMail = await mail.waitFor("marco.neri@stud.liceovoltacomo.edu.it", "Si è liberato un posto");
    const marcoToken = linkIn(marcoMail);
    check("5 · Mancata conferma", "proposta al secondo in lista", Boolean(marcoToken));
    await marco.goto(`${APP}/studente/attesa`);
    await settle(marco);
    check("5 · Area personale", "la proposta compare nell'area personale con «Conferma il posto»", (await marco.getByRole("button", { name: "Conferma il posto" }).count()) === 1);
    await marco.screenshot({ path: join(SHOTS, "proposta-area-personale-mobile.png"), fullPage: true });
    await expireOffersOf(marcoId); // passano 2 ore
    const cr2 = await cron();
    check("5 · Mancata conferma", "dopo 2 ore il cron fa scadere la proposta", cr2.body?.maintenance?.expired_offers === 1 && (await db.query("select status from public.seat_offers where student_id = $1", [marcoId])).rows[0].status === "expired", JSON.stringify(cr2.body));
    check("5 · Mancata conferma", "email di proposta scaduta", Boolean(await mail.waitFor("marco.neri@stud.liceovoltacomo.edu.it", "Proposta scaduta")));
    const expiredPage = await anonCtx.newPage();
    await expiredPage.goto(`${APP}/proposta/${marcoToken}`);
    check("Sicurezza link", "un link scaduto non permette di confermare", (await expiredPage.getByText("Proposta scaduta").count()) === 1 && (await expiredPage.getByRole("button", { name: "Conferma il posto" }).count()) === 0);
    const lucaMail = await mail.waitFor(await emailOf(luca), "Si è liberato un posto");
    check("6 · Successivo", "proposta automatica al successivo con email", Boolean(linkIn(lucaMail)));
    await marco.reload();
    await settle(marco);
    check("5 · Area personale", "lo storico mostra la proposta «Scaduta»", (await marco.getByText("Proposte ricevute").count()) === 1 && (await marco.getByText("Scaduta", { exact: true }).count()) >= 1);

    // rinuncia dal link → al successivo
    const lucaPage = await anonCtx.newPage();
    await lucaPage.goto(`${APP}/proposta/${linkIn(lucaMail)}`);
    await lucaPage.getByRole("button", { name: /rinuncio/ }).click();
    check("6 · Successivo", "rinuncia dal link", await lucaPage.getByText("Hai rinunciato al posto").waitFor({ timeout: 10000 }).then(() => true, () => false));
    check("6 · Successivo", "dopo la rinuncia il posto passa subito al successivo", Boolean(await mail.waitFor(await emailOf(sara), "Si è liberato un posto")));

    // =====================================================================
    // 7. Cancellazione dalla lista
    // =====================================================================
    const D2 = "2026-11-30";
    await fill(D2, 50);
    await marco.goto(`${APP}/studente/calendario`);
    await openDay(marco, D2);
    await settle(marco);
    await card(marco).getByRole("button", { name: /Iscriviti alla lista d'attesa/i }).click();
    await marco.getByText(/posizione 1/).waitFor({ timeout: 10000 });
    await rpc(tokenFor(paolo), "join_waitlist", { p_school_day_id: await dayId(D2) });
    await marco.goto(`${APP}/studente/attesa`);
    await settle(marco);
    await marco.locator("li").filter({ hasText: "lunedì 30 novembre" }).getByRole("button", { name: "Esci dalla lista" }).click();
    check("7 · Cancellazione", "uscita dalla lista dall'area personale", await marco.getByText("Sei uscito dalla lista d'attesa.").waitFor({ timeout: 10000 }).then(() => true, () => false));
    check("7 · Cancellazione", "iscrizione chiusa nel database", (await db.query("select status from public.waitlist_entries w join public.school_days d on d.id = w.school_day_id where w.student_id = $1 and d.day = $2", [marcoId, D2])).rows[0].status === "withdrawn");
    const paoloPos = (await rpc(tokenFor(paolo), "my_waitlist", {})).body.find((w) => w.day === D2);
    check("7 · Cancellazione", "chi era dietro sale di posizione (da 2° a 1°)", paoloPos?.queue_position === 1);

    // =====================================================================
    // Dashboard docenti
    // =====================================================================
    const admin = createClient(stack.env.NEXT_PUBLIC_SUPABASE_URL, stack.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    await admin.from("teacher_invitations").upsert({ email: "anna.rossi@liceovoltacomo.edu.it", full_name: "Anna Rossi", is_admin: true });
    const t = await admin.auth.admin.createUser({ email: "anna.rossi@liceovoltacomo.edu.it", password: stack.env.TEACHER_INITIAL_PASSWORD, email_confirm: true, user_metadata: { full_name: "Anna Rossi" } });
    await db.query("update public.teachers set must_change_password = false where id = $1", [t.data.user.id]);
    const tCtx = await newContext();
    const teacher = await tCtx.newPage();
    await teacher.goto(`${APP}/accesso/docenti`);
    await teacher.fill("#teacher-email", "anna.rossi@liceovoltacomo.edu.it");
    await teacher.fill("#teacher-password", stack.env.TEACHER_INITIAL_PASSWORD);
    await teacher.getByRole("button", { name: "Accedi all'area docenti" }).click();
    await teacher.waitForURL(`${APP}/docenti`, { timeout: 15000 });
    await teacher.goto(`${APP}/docenti/lista-attesa`);
    await settle(teacher);
    const dash = await teacher.locator("main").innerText();
    check("Dashboard docenti", "numero di studenti in attesa, proposte aperte e scadute", /In attesa\s*\d/i.test(dash) && dash.includes("In attesa di conferma") && dash.includes("Proposte scadute"));
    check("Dashboard docenti", "elenco in ordine cronologico con la proposta aperta", (await teacher.getByText("Proposta inviata").count()) >= 1 && (await teacher.locator("section").filter({ hasText: "giovedì 26 novembre" }).count()) >= 1);
    check("Dashboard docenti", "proposta scaduta di Marco Neri elencata", (await teacher.locator("li").filter({ hasText: "Marco Neri" }).filter({ hasText: "scaduta il" }).count()) >= 1);
    await teacher.screenshot({ path: join(SHOTS, "dashboard-lista.png"), fullPage: true });
    // tempo di conferma
    await teacher.selectOption("#offer-hours", "1");
    await teacher.selectOption("#offer-minutes", "0");
    await teacher.getByRole("button", { name: "Salva" }).click();
    check("Dashboard docenti", "tempo di conferma modificato a 1 ora", await teacher.getByText("Tempo di conferma aggiornato").waitFor({ timeout: 10000 }).then(() => true, () => false) && (await db.query("select offer_minutes from public.app_settings")).rows[0].offer_minutes === 60);
    // sospensione e riattivazione
    const d2Section = () => teacher.locator("section").filter({ hasText: "lunedì 30 novembre" });
    await d2Section().getByRole("button", { name: "Sospendi" }).click();
    await teacher.getByText("Lista sospesa: nessuna nuova iscrizione").waitFor({ timeout: 10000 });
    const pausedJoin = await rpc(tokenFor(marcoId), "join_waitlist", { p_school_day_id: await dayId(D2) });
    check("Dashboard docenti", "lista sospesa: nuove iscrizioni bloccate", pausedJoin.status >= 400 && String(pausedJoin.body?.message).includes("sospesa"));
    await settle(teacher);
    await d2Section().getByRole("button", { name: "Riattiva" }).click();
    check("Dashboard docenti", "lista riattivata", await teacher.getByText("Lista riattivata").waitFor({ timeout: 10000 }).then(() => true, () => false) && (await db.query("select waitlist_paused from public.school_days where day = $1", [D2])).rows[0].waitlist_paused === false);
    // rimozione di uno studente
    await settle(teacher);
    await d2Section().getByRole("button", { name: /Rimuovi .* dalla lista/ }).first().click();
    await d2Section().getByRole("button", { name: "Conferma" }).click();
    check("Dashboard docenti", "rimozione di uno studente dalla lista", await teacher.getByText("è stato rimosso dalla lista").waitFor({ timeout: 10000 }).then(() => true, () => false) && (await db.query("select status from public.waitlist_entries w join public.school_days d on d.id = w.school_day_id where w.student_id = $1 and d.day = $2", [paolo, D2])).rows[0].status === "withdrawn");
    const sDash = await rpc(tokenFor(paolo), "set_offer_minutes", { p_minutes: 30 });
    check("Dashboard docenti", "uno studente non può cambiare le impostazioni", sDash.status >= 400);
    const sNav = await giulia.goto(`${APP}/docenti/lista-attesa`).then(() => new URL(giulia.url()).pathname);
    check("Dashboard docenti", "uno studente non può aprire la dashboard docenti", sNav === "/studente");

    // =====================================================================
    // 8. Chiusura di una giornata (dal calendario gestionale)
    // =====================================================================
    const saraEmail = await emailOf(sara);
    const saraOffer = (await db.query("select status from public.seat_offers where student_id = $1 order by offered_at desc limit 1", [sara])).rows[0];
    await rpc(tokenFor(paolo), "join_waitlist", { p_school_day_id: await dayId(D1) }); // un altro in attesa su D1
    await teacher.goto(`${APP}/docenti/calendario`);
    await openDay(teacher, D1);
    await settle(teacher);
    await teacher.locator('label[for="day-open"]').click();
    await teacher.fill("#day-reason", "Assemblea d'istituto");
    await teacher.getByRole("button", { name: "Chiudi la giornata" }).click();
    await teacher.getByRole("button", { name: "Conferma chiusura" }).click(); // avviso automatico (scelta predefinita)
    check("8 · Chiusura", "il docente chiude la giornata", await teacher.getByText(/Prenotazioni bloccate\. \d+ studenti avvisati/).waitFor({ timeout: 10000 }).then(() => true, () => false));
    await teacher.screenshot({ path: join(SHOTS, "chiusura-giornata.png"), fullPage: true });
    check("8 · Chiusura", "la proposta aperta viene annullata", saraOffer?.status === "pending" && (await db.query("select status from public.seat_offers where student_id = $1 order by offered_at desc limit 1", [sara])).rows[0].status === "revoked");
    await cron();
    check("8 · Chiusura", "avviso email agli studenti prenotati", Boolean(await mail.waitFor("giulia.verdi@stud.liceovoltacomo.edu.it", "Aula studio chiusa")));
    check("8 · Chiusura", "avviso email agli studenti in lista d'attesa", Boolean(await mail.waitFor(saraEmail, "Aula studio chiusa")) && Boolean(await mail.waitFor(await emailOf(paolo), "Aula studio chiusa")));
    check("8 · Chiusura", "prenotazioni bloccate", (await rpc(tokenFor(marcoId), "book_seat", { p_school_day_id: await dayId(D1) })).status >= 400);
    check("8 · Chiusura", "lista d'attesa sospesa (iscrizioni e proposte)", (await rpc(tokenFor(marcoId), "join_waitlist", { p_school_day_id: await dayId(D1) })).status >= 400 && (await pendingOffers(D1)) === 0);

    // =====================================================================
    // 9. Scadenza delle 24 ore (giornate vicine create apposta)
    // =====================================================================
    await db.query("update public.app_settings set season_start = public.school_today(), offer_minutes = 120");
    await db.query("select public.generate_school_days(public.school_today() + 1, public.school_today() + 14)");
    const near = (await db.query("select day::text from public.school_days where day > public.school_today() + 2 and is_open order by day limit 2")).rows.map((r) => r.day);
    const [N1, N2] = near;
    const n1Fillers = await fill(N1, 50);
    const [w1, w2, w3, w4] = await createStudents(4, "vicino");
    for (const w of [w1, w2, w3]) await rpc(tokenFor(w), "join_waitlist", { p_school_day_id: await dayId(N1) });
    await cancelOf(n1Fillers[0], N1); // prima della soglia → proposta a w1
    await cron();
    const w1Token = linkIn(await mail.waitFor(await emailOf(w1), "Si è liberato un posto"));
    check("9 · Regola 24 ore", "prima della soglia la proposta parte", Boolean(w1Token));
    await db.query("update public.app_settings set cancellation_hours = 168"); // ora la soglia delle 24 ore è superata
    const lateJoin = await rpc(tokenFor(w4), "join_waitlist", { p_school_day_id: await dayId(N1) });
    check("9 · Regola 24 ore", "dopo la soglia non ci si può più iscrivere", lateJoin.status >= 400 && String(lateJoin.body?.message).includes("lista d'attesa è chiusa"));
    const lateAccept = await service("accept_offer_by_token", { p_token: w1Token });
    check("9 · Regola 24 ore", "una proposta inviata prima della soglia si può confermare anche dopo", lateAccept.status === 200, JSON.stringify(lateAccept.body));
    // dopo la soglia gli studenti non possono più annullare: il posto si libera per un annullamento della scuola
    const late = await db.query("update public.bookings set status = 'cancelled', cancelled_at = now(), cancel_reason = 'Annullata dalla scuola' where student_id = $1 and school_day_id = $2 returning id", [n1Fillers[1], await dayId(N1)]);
    check("9 · Regola 24 ore", "dopo la soglia lo studente non può più annullare da solo", (await cancelOf(n1Fillers[2], N1)).status >= 400 && late.rowCount === 1);
    await cron();
    check("9 · Regola 24 ore", "dopo la soglia un posto liberato non viene proposto", (await pendingOffers(N1)) === 0 && (await db.query("select status from public.waitlist_entries w join public.school_days d on d.id = w.school_day_id where w.student_id = $1 and d.day = $2", [w2, N1])).rows[0].status === "waiting");
    const free = await rpc(tokenFor(w4), "book_seat", { p_school_day_id: await dayId(N1) });
    check("9 · Regola 24 ore", "il posto torna prenotabile da tutti con le regole normali", free.status === 200);
    // proposta inviata prima della soglia che scade dopo la soglia
    await db.query("update public.app_settings set cancellation_hours = 24");
    const n2Fillers = await fill(N2, 50);
    const [v1, v2] = await createStudents(2, "soglia");
    for (const v of [v1, v2]) await rpc(tokenFor(v), "join_waitlist", { p_school_day_id: await dayId(N2) });
    await cancelOf(n2Fillers[0], N2);
    check("9 · Regola 24 ore", "proposta inviata prima della soglia", (await pendingOffers(N2)) === 1);
    await db.query("update public.app_settings set cancellation_hours = 168");
    await expireOffersOf(v1);
    const cr9 = await cron();
    check("9 · Regola 24 ore", "se scade dopo la soglia non si contatta il successivo", cr9.body?.maintenance?.expired_offers === 1 && (await pendingOffers(N2)) === 0 && (await mail.to(await emailOf(v2), "Si è liberato un posto")).length === 0, JSON.stringify(cr9.body?.maintenance));
    check("9 · Regola 24 ore", "il posto resta disponibile secondo le regole normali", (await rpc(tokenFor(w4), "book_seat", { p_school_day_id: await dayId(N2) })).status === 200);
    await db.query("update public.app_settings set cancellation_hours = 24");

    // =====================================================================
    // 10. Conferme contemporanee
    // =====================================================================
    const D3 = "2026-12-01";
    const d3Fillers = await fill(D3, 50);
    const d3Waiters = await createStudents(6, "gara");
    for (const w of d3Waiters) await rpc(tokenFor(w), "join_waitlist", { p_school_day_id: await dayId(D3) });
    await Promise.all(d3Fillers.slice(0, 3).map((f) => cancelOf(f, D3))); // 3 annullamenti simultanei
    check("10 · Conferme contemporanee", "3 annullamenti simultanei → 3 proposte ai primi 3 in ordine", (await pendingOffers(D3)) === 3 && (await db.query("select count(*)::int n from public.seat_offers where status = 'pending' and student_id = any($1)", [d3Waiters.slice(0, 3)])).rows[0].n === 3);
    await cron();
    const tokens = [];
    for (const w of d3Waiters.slice(0, 3)) tokens.push(linkIn(await mail.waitFor(await emailOf(w), "Si è liberato un posto")));
    const others = await createStudents(15, "assalto");
    const d3id = await dayId(D3);
    // tutto insieme: 3 link confermati 3 volte ciascuno (doppio clic) + 15 studenti che provano a prenotare
    const all = await Promise.all([
      ...tokens.map((tk) => service("accept_offer_by_token", { p_token: tk })),
      ...tokens.map((tk) => service("accept_offer_by_token", { p_token: tk })),
      ...tokens.map((tk) => service("accept_offer_by_token", { p_token: tk })),
      ...others.map((o) => rpc(tokenFor(o), "book_seat", { p_school_day_id: d3id })),
    ]);
    const storm = all.slice(0, 9);
    const storm2 = all.slice(9);
    const accepted = (await db.query("select count(*)::int n from public.seat_offers where status = 'accepted' and student_id = any($1)", [d3Waiters.slice(0, 3)])).rows[0].n;
    check("10 · Conferme contemporanee", "9 conferme simultanee (3 link × 3 clic) → 3 posti assegnati, uno per link", accepted === 3 && storm.slice(0, 9).filter((r) => r.status === 200).length === 3, storm.slice(0, 9).map((r) => r.status).join(","));
    check("10 · Conferme contemporanee", "15 prenotazioni concorrenti durante le conferme: tutte respinte", storm2.slice(0, 15).every((r) => r.status >= 400));
    check("10 · Conferme contemporanee", "mai più di 50 prenotazioni attive", (await confirmed(D3)) === 50);
    // ultimo posto conteso tra conferma e annullamento-riprenotazione
    await cancelOf(d3Fillers[5], D3);
    const tk4 = linkIn(await (async () => { await cron(); return mail.waitFor(await emailOf(d3Waiters[3]), "Si è liberato un posto"); })());
    const race = await Promise.all([service("accept_offer_by_token", { p_token: tk4 }), ...others.slice(0, 10).map((o) => rpc(tokenFor(o), "book_seat", { p_school_day_id: d3id }))]);
    check("10 · Conferme contemporanee", "conferma dell'ultimo posto contro 10 prenotazioni simultanee: vince la proposta", race[0].status === 200 && race.slice(1).every((r) => r.status >= 400) && (await confirmed(D3)) === 50);
    const maxDay = (await db.query("select max(n)::int m from (select count(*) n from public.bookings where status = 'confirmed' group by school_day_id) t")).rows[0].m;
    check("10 · Conferme contemporanee", "in nessuna giornata più di 50 prenotazioni", maxDay <= 50, String(maxDay));

    // =====================================================================
    // 8bis. Automazione senza utenti collegati: manutenzione del database
    // =====================================================================
    await browser.close();
    browser = null;
    const D4 = "2026-12-03";
    const d4Fillers = await fill(D4, 50);
    const [x1, x2] = await createStudents(2, "notte");
    for (const x of [x1, x2]) await rpc(tokenFor(x), "join_waitlist", { p_school_day_id: await dayId(D4) });
    await cancelOf(d4Fillers[0], D4);
    await expireOffersOf(x1);
    await db.query("select public.run_waitlist_maintenance()"); // ciò che esegue Supabase Cron ogni minuto
    check("8 · Automazione", "senza browser aperti la manutenzione del database fa scadere e riassegna", (await db.query("select status from public.seat_offers where student_id = $1", [x1])).rows[0].status === "expired" && (await db.query("select status from public.seat_offers where student_id = $1", [x2])).rows[0]?.status === "pending");
    const leftover = (await db.query("select count(*)::int n from public.notification_outbox where status = 'sent' and payload ? 'token'")).rows[0].n;
    check("8 · Automazione", "dopo l'invio nessun token in chiaro resta nella coda", leftover === 0);
  } finally {
    await browser?.close().catch(() => {});
    if (server?.pid) {
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {}
    }
    await pool.end().catch(() => {});
    await stack.stop();
    await google.stop();
    await mail.stop();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} verifiche superate`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
