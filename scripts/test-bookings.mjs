/**
 * BIBLIOVOLTA · Test end-to-end delle prenotazioni (Fase 4)
 *
 *   npm run test:bookings        (Linux, root: come test:auth)
 *
 * Stack Supabase locale reale (PostgreSQL 17, Supabase Auth, PostgREST),
 * app Next.js compilata e Chrome. Gli studenti "di riempimento" sono creati
 * direttamente nel database con identità Google, gli studenti del test
 * accedono dal browser come in Fase 3 (provider OpenID di prova).
 * La concorrenza è verificata con transazioni realmente simultanee su
 * PostgreSQL e con chiamate parallele alle API di Supabase.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { chromium } from "playwright";
import { GOOGLE_TEST_CLIENT, startStack } from "./local-stack/stack.mjs";
import { startMockGoogle } from "./local-stack/mock-google.mjs";

const ROOT = process.cwd();
const APP = "http://localhost:3400";
const SHOTS = join(ROOT, ".local-stack", "screens-bookings");
const FULL_MSG = "È stato raggiunto il numero massimo di 50 prenotazioni. Puoi iscriverti alla lista d'attesa.";
const results = [];
const check = (group, name, ok, detail = "") => {
  results.push({ group, name, ok: Boolean(ok), detail });
  console.log(`${ok ? "✔" : "✘"} [${group}] ${name}${!ok && detail ? `  →  ${detail}` : ""}`);
};
const run = (cmd, args, env) =>
  new Promise((ok, ko) => spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: "ignore" }).on("exit", (c) => (c === 0 ? ok() : ko(new Error(`${cmd} ${c}`)))));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url) {
  for (let i = 0; i < 120; i++) {
    try {
      await fetch(url, { redirect: "manual" });
      return;
    } catch {}
    await sleep(500);
  }
  throw new Error(`${url} non risponde`);
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  const google = await startMockGoogle({ dir: join(ROOT, ".local-stack", "mock-google"), clientId: GOOGLE_TEST_CLIENT.id, clientSecret: GOOGLE_TEST_CLIENT.secret });
  const stack = await startStack({ fresh: true, googleCaBundle: google.caBundle });
  const env = { ...stack.env, NEXT_DIST_DIR: ".next-test", NEXT_TELEMETRY_DISABLED: "1" };
  const db = stack.db;
  let server;
  let browser;
  const pool = new pg.Pool({ host: "127.0.0.1", port: stack.ports.pg, user: "postgres", password: "postgres", database: "postgres", max: 40 });
  try {
    if (!process.argv.includes("--no-build") || !existsSync(join(ROOT, ".next-test"))) {
      console.log("Compilo l'app per il test…");
      await run("npx", ["next", "build"], env);
    }
    if (await fetch(APP).then(() => true, () => false)) throw new Error("La porta 3400 è occupata.");
    server = spawn(join(ROOT, "node_modules", ".bin", "next"), ["start", "-p", "3400"], { cwd: ROOT, env: { ...process.env, ...env }, stdio: process.env.APP_LOG ? "inherit" : "ignore", detached: true });
    await waitFor(APP);

    // ---------- utilità ------------------------------------------------
    const dayId = async (d) => (await db.query("select id from public.school_days where day = $1", [d])).rows[0].id;
    let seq = 0;
    const createStudents = async (n, prefix) => {
      const ids = [];
      for (let i = 0; i < n; i++) {
        const email = `${prefix}${seq++}@stud.liceovoltacomo.edu.it`;
        const r = await db.query(
          `insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
           values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', $1,
                   '{"provider":"google","providers":["google"]}', jsonb_build_object('email_verified', true, 'full_name', 'Prova ' || $2::text), now(), now(), now())
           returning id`,
          [email, String(seq)],
        );
        ids.push(r.rows[0].id);
      }
      await db.query("update public.students set first_name = 'Prova', last_name = 'Studente', class_name = '3A', registered_at = now() where id = any($1)", [ids]);
      return ids;
    };
    const fill = async (date, n) => {
      const ids = await createStudents(n, `riempimento${date.replaceAll("-", "")}x`);
      const id = await dayId(date);
      await db.query("insert into public.bookings (student_id, school_day_id, created_by) select unnest($1::uuid[]), $2, unnest($1::uuid[])", [ids, id]);
    };
    const confirmed = async (date) =>
      (await db.query("select count(*)::int n from public.bookings b join public.school_days d on d.id = b.school_day_id where d.day = $1 and b.status = 'confirmed'", [date])).rows[0].n;
    const tokenFor = (id) => stack.sign({ sub: id, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600, amr: [{ method: "oauth", timestamp: 1 }] });
    const rpc = (token, fn, body) =>
      fetch(`${stack.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers: { apikey: stack.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
    /** Prenotazione in una transazione PostgreSQL dedicata (come farebbe PostgREST). */
    const bookTx = async (studentId, schoolDayId) => {
      const c = await pool.connect();
      try {
        await c.query("begin");
        await c.query("set local role authenticated");
        await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: studentId, role: "authenticated" })]);
        await c.query("select public.book_seat($1)", [schoolDayId]);
        await c.query("commit");
        return { ok: true };
      } catch (e) {
        await c.query("rollback").catch(() => {});
        return { ok: false, error: e.message };
      } finally {
        c.release();
      }
    };

    browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
      args: ["--no-sandbox", "--no-proxy-server", "--host-resolver-rules=MAP accounts.google.com 127.0.0.1, MAP *.googleapis.com 127.0.0.1"],
    });
    const newContext = (mobile = false) =>
      browser.newContext({ ignoreHTTPSErrors: true, reducedMotion: "reduce", ...(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 900 } }) });
    const accessTokenOf = async (ctx) => {
      const cookies = (await ctx.cookies()).filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name)).sort((a, b) => a.name.localeCompare(b.name));
      let value = cookies.map((c) => c.value).join("");
      if (value.startsWith("base64-")) value = Buffer.from(value.slice(7), "base64url").toString();
      return JSON.parse(value).access_token;
    };
    const loginAndRegister = async (page, account, classYear, section) => {
      google.useAccount(account);
      await page.goto(`${APP}/accesso`);
      await page.getByRole("button", { name: "Accedi con Google" }).click();
      await page.waitForURL(`${APP}/registrazione`, { timeout: 20000 });
      await page.selectOption("#reg-year", classYear);
      await page.fill("#reg-section", section);
      await page.getByRole("button", { name: /Completa la registrazione/ }).click();
      await page.waitForURL(`${APP}/studente`, { timeout: 20000 });
    };
    const openDay = async (page, date) => {
      // la cella del calendario ha un'etichetta accessibile con la data in italiano
      const label = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
      const [y, m] = date.split("-").map(Number);
      for (let i = 0; i < 9; i++) {
        const cell = page.locator(`[role="gridcell"][aria-label^="${label}"]`);
        if (await cell.count()) {
          await cell.click();
          return;
        }
        const heading = await page.locator("h2[aria-live]").innerText();
        const months = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
        const [mName, yStr] = heading.toLowerCase().split(" ");
        const current = Number(yStr) * 12 + months.indexOf(mName);
        await page.getByRole("button", { name: current < y * 12 + m - 1 ? "Mese successivo" : "Mese precedente" }).click();
      }
      throw new Error(`giornata ${date} non trovata nel calendario`);
    };
    const card = (page) => page.locator("article").filter({ has: page.getByText("Giornata", { exact: true }) });
    const settle = (page) => page.waitForTimeout(600);

    // ------------------------------------------------------------------
    // Calendario generato
    // ------------------------------------------------------------------
    const cal = (await db.query(`select count(*)::int n, min(day)::text a, max(day)::text b,
        count(*) filter (where not is_open)::int closed,
        bool_and(capacity = 50) cap,
        count(*) filter (where extract(isodow from day) > 5)::int weekend
      from public.school_days`)).rows[0];
    check("Calendario", "145 giornate da lunedì 16/11/2026 a venerdì 4/6/2027, senza weekend", cal.n === 145 && cal.a === "2026-11-16" && cal.b === "2027-06-04" && cal.weekend === 0, JSON.stringify(cal));
    check("Calendario", "festività nazionali escluse fin dall'inizio (6 giornate feriali)", cal.closed === 6);
    check("Calendario", "capienza 50 per ogni giornata", cal.cap === true);

    // ------------------------------------------------------------------
    // Studenti del test (accesso reale dal browser)
    // ------------------------------------------------------------------
    const giuliaCtx = await newContext();
    const giulia = await giuliaCtx.newPage();
    await loginAndRegister(giulia, { email: "giulia.verdi@stud.liceovoltacomo.edu.it", email_verified: true, name: "Giulia Verdi" }, "4", "B");
    const giuliaToken = await accessTokenOf(giuliaCtx);
    const giuliaId = (await db.query("select id from public.students where email = 'giulia.verdi@stud.liceovoltacomo.edu.it'")).rows[0].id;

    // ------------------------------------------------------------------
    // 1. Prenotazione normale
    // ------------------------------------------------------------------
    await giulia.goto(`${APP}/studente/calendario`);
    await openDay(giulia, "2026-11-16");
    await settle(giulia);
    const c1 = card(giulia);
    check("Informazioni giornaliere", "data e giorno della settimana", (await c1.getByRole("heading").innerText()).toLowerCase().includes("lunedì 16 novembre"));
    check("Informazioni giornaliere", "prenotazioni, posti disponibili e stato DISPONIBILE", (await c1.getByText("Prenotazioni").count()) > 0 && (await c1.getByText("Posti disponibili").count()) > 0 && (await c1.getByText("DISPONIBILE", { exact: true }).count()) === 1);
    await giulia.screenshot({ path: join(SHOTS, "calendario.png") });
    await c1.getByRole("button", { name: "Prenota il posto" }).click();
    const sheet = giulia.getByRole("dialog");
    await sheet.waitFor();
    check("Prenotazione normale", "riepilogo con i dati del profilo, senza richiederli", (await sheet.getByText("Giulia Verdi").count()) === 1 && (await sheet.getByText("Classe 4B").count()) === 1 && (await sheet.locator("input").count()) === 0);
    await giulia.screenshot({ path: join(SHOTS, "conferma.png") });
    await sheet.getByRole("button", { name: "Conferma" }).click();
    const confirmedShown = await sheet.getByText("Il tuo posto è riservato").waitFor({ timeout: 10000 }).then(() => true, () => false);
    check("Prenotazione normale", "conferma a schermo", confirmedShown && (await sheet.getByRole("heading", { name: "Prenotazione confermata" }).count()) === 1);
    await giulia.screenshot({ path: join(SHOTS, "confermata.png") });
    check("Prenotazione normale", "prenotazione salvata nel database", (await confirmed("2026-11-16")) === 1);
    await sheet.getByRole("button", { name: "Fatto" }).click();
    await settle(giulia);
    const after1 = await card(giulia).innerText();
    check("Aggiornamento immediato", "dopo la prenotazione la scheda mostra 1/50 e 49 posti senza ricaricare", /1\s*\/50/.test(after1) && after1.includes("49") && after1.includes("Prenotata da te"), after1.replace(/\s+/g, " ").slice(0, 200));
    check("Aggiornamento immediato", "la cella del calendario mostra 49 posti liberi", (await giulia.locator('[role="gridcell"][aria-label^="lunedì 16 novembre"]').getAttribute("aria-label")).includes("49 posti liberi"));

    // ------------------------------------------------------------------
    // Prenotazioni duplicate
    // ------------------------------------------------------------------
    const dupApi = await rpc(giuliaToken, "book_seat", { p_school_day_id: await dayId("2026-11-16") });
    check("Prenotazioni duplicate", "una seconda prenotazione della stessa giornata è rifiutata", dupApi.status >= 400 && String(dupApi.body?.message).includes("Hai già una prenotazione"), JSON.stringify(dupApi.body));
    const dupDay = await dayId("2026-11-23");
    const dupRace = await Promise.all(Array.from({ length: 10 }, () => bookTx(giuliaId, dupDay)));
    check("Prenotazioni duplicate", "10 richieste simultanee dello stesso studente → 1 sola prenotazione", dupRace.filter((r) => r.ok).length === 1 && (await confirmed("2026-11-23")) === 1, JSON.stringify(dupRace.map((r) => r.ok)));
    check("Prenotazioni duplicate", "nel calendario il pulsante Prenota non compare più", await (async () => { await giulia.reload(); await openDay(giulia, "2026-11-16"); await settle(giulia); return (await card(giulia).getByRole("button", { name: "Prenota il posto" }).count()) === 0; })());

    // ------------------------------------------------------------------
    // QUASI COMPLETA (≤ 5 posti)
    // ------------------------------------------------------------------
    await fill("2026-11-17", 45);
    await giulia.reload();
    await openDay(giulia, "2026-11-17");
    await settle(giulia);
    const c2 = await card(giulia).innerText();
    check("Informazioni giornaliere", "con 5 posti: stato QUASI COMPLETA ed evidenza", c2.includes("QUASI COMPLETA") && c2.includes("Solo 5 posti disponibili!"), c2.replace(/\s+/g, " ").slice(0, 200));
    await giulia.screenshot({ path: join(SHOTS, "quasi-completa.png") });

    // ------------------------------------------------------------------
    // Ultimo posto e cinquantunesima prenotazione
    // ------------------------------------------------------------------
    await fill("2026-11-18", 49);
    await giulia.reload();
    await openDay(giulia, "2026-11-18");
    await settle(giulia);
    check("Ultimo posto", "con 49 prenotazioni resta 1 posto", (await card(giulia).innerText()).includes("Ultimo posto disponibile!"));
    await card(giulia).getByRole("button", { name: "Prenota il posto" }).click();
    await giulia.getByRole("dialog").getByRole("button", { name: "Conferma" }).click();
    check("Ultimo posto", "l'ultimo posto si prenota", await giulia.getByRole("dialog").getByText("Il tuo posto è riservato").waitFor({ timeout: 10000 }).then(() => true, () => false));
    await giulia.getByRole("dialog").getByRole("button", { name: "Fatto" }).click();
    await settle(giulia);
    const full = await card(giulia).innerText();
    check("Ultimo posto", "la giornata diventa COMPLETA con 50/50", full.includes("COMPLETA") && /50\s*\/50/.test(full) && (await confirmed("2026-11-18")) === 50);

    const marcoCtx = await newContext(true);
    const marco = await marcoCtx.newPage();
    await loginAndRegister(marco, { email: "marco.neri@stud.liceovoltacomo.edu.it", email_verified: true, name: "Marco Neri" }, "5", "A");
    const marcoToken = await accessTokenOf(marcoCtx);
    await marco.goto(`${APP}/studente/calendario`);
    await openDay(marco, "2026-11-18");
    await settle(marco);
    const mFull = await card(marco).innerText();
    check("Cinquantunesima prenotazione", "stato COMPLETA e messaggio previsto", mFull.includes("COMPLETA") && mFull.includes(FULL_MSG), mFull.replace(/\s+/g, " ").slice(0, 300));
    check("Cinquantunesima prenotazione", "nessun pulsante per prenotare", (await card(marco).getByRole("button", { name: "Prenota il posto" }).count()) === 0);
    await marco.screenshot({ path: join(SHOTS, "completa-mobile.png") });
    const forced = await rpc(marcoToken, "book_seat", { p_school_day_id: await dayId("2026-11-18") });
    check("Cinquantunesima prenotazione", "anche chiamando direttamente l'API la 51ª è rifiutata con lo stesso messaggio", forced.status >= 400 && forced.body?.message === FULL_MSG && (await confirmed("2026-11-18")) === 50, JSON.stringify(forced.body));

    // ------------------------------------------------------------------
    // Prenotazioni contemporanee
    // ------------------------------------------------------------------
    await fill("2026-11-19", 47);
    const racers = await createStudents(20, "gara");
    const d19 = await dayId("2026-11-19");
    const race1 = await Promise.all(racers.map((id) => bookTx(id, d19)));
    check("Prenotazioni contemporanee", "20 transazioni simultanee per gli ultimi 3 posti → esattamente 3 riuscite", race1.filter((r) => r.ok).length === 3 && (await confirmed("2026-11-19")) === 50, `${race1.filter((r) => r.ok).length} riuscite`);
    check("Prenotazioni contemporanee", "le altre 17 ricevono il messaggio di giornata completa", race1.filter((r) => !r.ok && r.error === FULL_MSG).length === 17);
    const crowd = await createStudents(70, "folla");
    const d20 = await dayId("2026-11-20");
    const race2 = await Promise.all(crowd.map((id) => rpc(tokenFor(id), "book_seat", { p_school_day_id: d20 })));
    check("Prenotazioni contemporanee", "70 richieste parallele alle API Supabase per 50 posti → esattamente 50", race2.filter((r) => r.status === 200).length === 50 && (await confirmed("2026-11-20")) === 50, `${race2.filter((r) => r.status === 200).length} riuscite`);
    const lastSeat = await createStudents(2, "ultimo");
    await fill("2026-11-24", 49);
    const d24 = await dayId("2026-11-24");
    const duel = await Promise.all(lastSeat.map((id) => bookTx(id, d24)));
    check("Prenotazioni contemporanee", "due studenti nello stesso istante per l'ultimo posto → uno solo lo ottiene", duel.filter((r) => r.ok).length === 1 && (await confirmed("2026-11-24")) === 50);
    const max = (await db.query("select max(n)::int m from (select count(*) n from public.bookings where status = 'confirmed' group by school_day_id) t")).rows[0].m;
    check("Prenotazioni contemporanee", "in nessuna giornata più di 50 prenotazioni attive", max <= 50, String(max));

    // ------------------------------------------------------------------
    // Cancellazione dall'area personale
    // ------------------------------------------------------------------
    await giulia.goto(`${APP}/studente`);
    await settle(giulia);
    const nov16 = giulia.locator("li").filter({ hasText: "lunedì 16 novembre" });
    check("Area personale", "prenotazioni future con data della prenotazione e stato", (await nov16.getByText(/Prenotata il/).count()) === 1 && (await nov16.getByText("Confermata").count()) === 1);
    await giulia.screenshot({ path: join(SHOTS, "area-personale.png"), fullPage: true });
    await nov16.getByRole("button", { name: /Annulla la prenotazione/ }).click();
    await giulia.getByRole("dialog").getByRole("button", { name: "Sì, annulla" }).click();
    check("Cancellazione", "conferma a schermo dell'annullamento", await giulia.getByRole("dialog").getByText("Il posto è di nuovo disponibile").waitFor({ timeout: 10000 }).then(() => true, () => false));
    check("Cancellazione", "prenotazione annullata nel database e posto liberato", (await confirmed("2026-11-16")) === 0);
    await giulia.getByRole("dialog").getByRole("button", { name: "Chiudi", exact: true }).click();
    await settle(giulia);
    check("Cancellazione", "l'area personale si aggiorna subito", (await giulia.locator("li").filter({ hasText: "lunedì 16 novembre" }).count()) === 0);
    await giulia.goto(`${APP}/studente/calendario`);
    await openDay(giulia, "2026-11-16");
    await settle(giulia);
    check("Cancellazione", "nel calendario la giornata torna a 50 posti disponibili", (await card(giulia).innerText()).includes("50") && (await card(giulia).getByRole("button", { name: "Prenota il posto" }).count()) === 1);

    // il posto liberato da una giornata completa torna prenotabile
    await rpc(giuliaToken, "cancel_booking", { p_booking_id: (await db.query("select b.id from public.bookings b join public.school_days d on d.id = b.school_day_id where d.day = '2026-11-18' and b.student_id = $1 and b.status = 'confirmed'", [giuliaId])).rows[0].id });
    await marco.reload();
    await openDay(marco, "2026-11-18");
    await settle(marco);
    check("Cancellazione", "il posto liberato su una giornata completa è subito prenotabile da altri", (await card(marco).getByRole("button", { name: "Prenota il posto" }).count()) === 1);

    // ------------------------------------------------------------------
    // Blocco della cancellazione dopo la scadenza
    // ------------------------------------------------------------------
    await db.query("update public.app_settings set season_start = public.school_today()");
    await db.query("select public.generate_school_days(public.school_today() + 1, public.school_today() + 9)");
    await db.query("update public.app_settings set cancellation_hours = 168"); // la scadenza diventa 7 giorni prima: già passata
    const soon = (await db.query("select id, day::text from public.school_days where day > public.school_today() and is_open order by day limit 1")).rows[0];
    const lateBook = await rpc(giuliaToken, "book_seat", { p_school_day_id: soon.id });
    check("Scadenza 24 ore", "prenotazione di una giornata vicina (prima dell'apertura) consentita", lateBook.status === 200, JSON.stringify(lateBook.body));
    await giulia.goto(`${APP}/studente/prenotazioni`);
    await settle(giulia);
    const lateItem = giulia.locator("li").filter({ hasText: "Non più annullabile" }).first();
    check("Scadenza 24 ore", "dopo la scadenza il pulsante Annulla è disabilitato", (await lateItem.count()) === 1 && (await lateItem.getByRole("button", { name: /Annulla la prenotazione/ }).isDisabled()));
    await giulia.screenshot({ path: join(SHOTS, "scadenza.png"), fullPage: true });
    const lateCancel = await rpc(giuliaToken, "cancel_booking", { p_booking_id: lateBook.body?.id });
    check("Scadenza 24 ore", "il server rifiuta l'annullamento anche chiamando direttamente l'API", lateCancel.status >= 400 && String(lateCancel.body?.message).startsWith("Non è più possibile annullare"), JSON.stringify(lateCancel.body));
    check("Scadenza 24 ore", "la prenotazione resta confermata", (await db.query("select status from public.bookings where id = $1", [lateBook.body?.id])).rows[0].status === "confirmed");
    await db.query("update public.app_settings set cancellation_hours = 24");

    // ------------------------------------------------------------------
    // Fuso orario Europe/Rome: ora legale
    // ------------------------------------------------------------------
    const april = await rpc(giuliaToken, "book_seat", { p_school_day_id: await dayId("2027-04-12") });
    const aprilRow = (await rpc(giuliaToken, "my_bookings", {})).body.find((b) => b.booking_id === april.body?.id);
    check("Orari", "scadenza in ora legale: 11 aprile 2027 alle 14:15 di Roma (12:15 UTC)", new Date(aprilRow?.cancel_deadline).toISOString() === "2027-04-11T12:15:00.000Z", aprilRow?.cancel_deadline);
    await giulia.goto(`${APP}/studente/prenotazioni`);
    await settle(giulia);
    check("Orari", "l'area personale mostra la scadenza in ora italiana", (await giulia.locator("li").filter({ hasText: "lunedì 12 aprile" }).getByText(/11 apr.*14:15/).count()) === 1);

    // ------------------------------------------------------------------
    // Aggiornamento del calendario per gli altri studenti
    // ------------------------------------------------------------------
    await marco.goto(`${APP}/studente/calendario`);
    await openDay(marco, "2026-11-25");
    await settle(marco);
    const before = (await card(marco).innerText()).match(/(\d+)\s*\/50/)?.[1];
    await rpc(giuliaToken, "book_seat", { p_school_day_id: await dayId("2026-11-25") });
    await marco.evaluate(() => window.dispatchEvent(new Event("focus")));
    const updated = await marco.waitForFunction(() => /1\s*\/50/.test(document.querySelector("article")?.innerText ?? ""), null, { timeout: 15000 }).then(() => true, () => false);
    check("Aggiornamento immediato", "il calendario di un altro studente si aggiorna senza ricaricare la pagina", before === "0" && updated, `prima ${before}`);

    // ------------------------------------------------------------------
    // Orario configurabile dai docenti
    // ------------------------------------------------------------------
    const admin = createClient(stack.env.NEXT_PUBLIC_SUPABASE_URL, stack.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    await admin.from("teacher_invitations").upsert({ email: "anna.rossi@liceovoltacomo.edu.it", full_name: "Anna Rossi", is_admin: true });
    const created = await admin.auth.admin.createUser({ email: "anna.rossi@liceovoltacomo.edu.it", password: stack.env.TEACHER_INITIAL_PASSWORD, email_confirm: true, user_metadata: { full_name: "Anna Rossi" } });
    await db.query("update public.teachers set must_change_password = false where id = $1", [created.data.user.id]);
    const tCtx = await newContext();
    const teacher = await tCtx.newPage();
    await teacher.goto(`${APP}/accesso/docenti`);
    await teacher.fill("#teacher-email", "anna.rossi@liceovoltacomo.edu.it");
    await teacher.fill("#teacher-password", stack.env.TEACHER_INITIAL_PASSWORD);
    await teacher.getByRole("button", { name: "Accedi all'area docenti" }).click();
    await teacher.waitForURL(`${APP}/docenti`, { timeout: 15000 });
    await teacher.goto(`${APP}/docenti/calendario`); // orario generale: nel calendario gestionale (Fase 6)
    await teacher.fill("#hours-open", "15:00");
    await teacher.fill("#hours-close", "17:00");
    await teacher.getByRole("button", { name: "Salva orario" }).click();
    check("Orari", "il docente cambia l'orario di apertura", await teacher.getByText("Orario aggiornato").waitFor({ timeout: 10000 }).then(() => true, () => false));
    await teacher.screenshot({ path: join(SHOTS, "docenti-orario.png"), fullPage: true });
    const newHours = (await db.query("select opens_at::text o, closes_at::text c from public.school_days where day = '2026-12-01'")).rows[0];
    check("Orari", "le giornate future usano il nuovo orario", newHours.o === "15:00:00" && newHours.c === "17:00:00", JSON.stringify(newHours));
    const dec1 = (await rpc(giuliaToken, "book_seat", { p_school_day_id: await dayId("2026-12-01") })).body;
    const dec1Row = (await rpc(giuliaToken, "my_bookings", {})).body.find((b) => b.booking_id === dec1?.id);
    check("Orari", "la scadenza segue il nuovo orario (30/11 alle 15:00 di Roma)", new Date(dec1Row?.cancel_deadline).toISOString() === "2026-11-30T14:00:00.000Z", dec1Row?.cancel_deadline);
    await giulia.goto(`${APP}/studente/calendario`);
    await openDay(giulia, "2026-12-01");
    await settle(giulia);
    check("Orari", "lo studente vede il nuovo orario nel calendario", (await card(giulia).innerText()).includes("15:00 – 17:00"));
    const studentHours = await rpc(giuliaToken, "set_opening_hours", { p_opens_at: "08:00", p_closes_at: "09:00" });
    check("Orari", "uno studente non può cambiare l'orario", studentHours.status >= 400);
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
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} verifiche superate`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
