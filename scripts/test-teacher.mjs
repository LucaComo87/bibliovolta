/**
 * BIBLIOVOLTA · Test end-to-end della dashboard docenti e delle comunicazioni (Fase 6)
 *
 *   npm run test:teacher        (Linux, root: come test:auth)
 *
 * Stack Supabase locale reale (PostgreSQL + Auth + API), app Next.js
 * compilata, Chrome guidato da Playwright e server email di prova che
 * risponde come l'API di Resend: ogni operazione è fatta dall'interfaccia
 * del docente e verificata direttamente nel database e nelle email
 * effettivamente ricevute dal servizio di invio.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import { chromium } from "playwright";
import { GOOGLE_TEST_CLIENT, startStack } from "./local-stack/stack.mjs";
import { startMockGoogle } from "./local-stack/mock-google.mjs";
import { startMockResend } from "./local-stack/mock-resend.mjs";

const ROOT = process.cwd();
const APP = "http://localhost:3400";
const SHOTS = join(ROOT, ".local-stack", "screens-teacher");
const CRON_SECRET = "test-cron-secret-0123456789abcdef";
const results = [];
const check = (group, name, ok, detail = "") => {
  results.push({ group, name, ok: Boolean(ok), detail });
  console.log(`${ok ? "✔" : "✘"} [${group}] ${name}${!ok && detail ? `  →  ${detail}` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (cmd, args, env) =>
  new Promise((ok, ko) => spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: "ignore" }).on("exit", (c) => (c === 0 ? ok() : ko(new Error(`${cmd} ${c}`)))));
const waitUntil = async (fn, timeout = 15000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await fn()) return true;
    await sleep(250);
  }
  return false;
};

/** Studenti con nomi realistici per la giornata principale (D1). */
const PEOPLE = [
  ["Giulia", "Bianchi", "4B"],
  ["Marco", "Rossi", "5A"],
  ["Sara", "Colombo", "4B"],
  ["Luca", "Ferrari", "3C"],
  ["Elena", "Ricci", "5A"],
  ["Paolo", "Esposito", "4B"],
  ["Chiara", "Romano", "3C"],
  ["Andrea", "Gallo", "5A"],
  ["Francesca", "Conti", "2D"],
  ["Davide", "Bruno", "4B"],
  ["Martina", "Greco", "5A"],
  ["Rita", "Rifiutata", "3C"], // indirizzo che il servizio email rifiuta: verifica degli errori di invio
];
const emailFor = (first, last) => `${first}.${last}`.toLowerCase() + "@stud.liceovoltacomo.edu.it";

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
    const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
    let seq = 0;
    const createStudent = async (email, first, last, klass) => {
      const r = await db.query(
        `insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
         values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', $1,
                 '{"provider":"google","providers":["google"]}', '{"email_verified":true}', now(), now(), now()) returning id`, [email]);
      const id = r.rows[0].id;
      await db.query("update public.students set first_name = $2, last_name = $3, full_name = $2 || ' ' || $3, class_name = $4, registered_at = now() where id = $1", [id, first, last, klass]);
      return id;
    };
    const createMany = async (n, prefix, klass = "3A") => {
      const ids = [];
      for (let i = 0; i < n; i++) ids.push(await createStudent(`${prefix}${seq++}@stud.liceovoltacomo.edu.it`, "Prova", `N${seq}`, klass));
      return ids;
    };
    const book = async (ids, date, minutesAgo = 0) => {
      const d = await dayId(date);
      for (const [i, id] of ids.entries())
        await db.query("insert into public.bookings (student_id, school_day_id, created_by, created_at) values ($1, $2, $1, now() - make_interval(mins => $3))", [id, d, minutesAgo + (ids.length - i) * 7]);
    };
    const tokenFor = (id) => stack.sign({ sub: id, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 });
    const rpc = (token, fn, body) =>
      fetch(`${stack.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers: { apikey: stack.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
    const cron = () => fetch(`${APP}/api/cron/notifications`, { headers: { authorization: `Bearer ${CRON_SECRET}` } }).then((r) => r.json().catch(() => null));
    const logCount = async (action) => (await one("select count(*)::int n from public.audit_log where action = $1", [`docente.${action}`])).n;
    const mailsWith = (subjectPart) => mail.messages.filter((m) => m.subject.includes(subjectPart));

    // ---------------- dati della prova ----------------
    const D1 = "2026-11-26"; // giovedì: 12 prenotati con nomi reali
    const D2 = "2026-11-30"; // lunedì: completa (50) + 3 in lista d'attesa
    const D3 = "2026-12-01"; // martedì: 4 prenotati, chiusura senza email
    const people = [];
    for (const [first, last, klass] of PEOPLE) people.push({ id: await createStudent(emailFor(first, last), first, last, klass), first, last, klass, email: emailFor(first, last) });
    await book(people.map((p) => p.id), D1, 60);
    const d2Fill = await createMany(50, "pieno", "5B");
    await book(d2Fill, D2);
    const waiters = await createMany(3, "attesa", "2D");
    for (const w of waiters) await rpc(tokenFor(w), "join_waitlist", { p_school_day_id: await dayId(D2) });
    const d3People = await createMany(4, "martedi", "1A");
    await book(d3People, D3);
    check("Preparazione", "dati di prova nel database (12 + 50 + 3 in attesa + 4)", (await one("select count(*)::int n from public.bookings where status = 'confirmed'")).n === 66 && (await one("select count(*)::int n from public.waitlist_entries where status = 'waiting'")).n === 3);

    // ---------------- accesso del docente ----------------
    const admin = createClient(stack.env.NEXT_PUBLIC_SUPABASE_URL, stack.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    await admin.from("teacher_invitations").upsert({ email: "anna.rossi@liceovoltacomo.edu.it", full_name: "Anna Rossi", is_admin: true });
    const t = await admin.auth.admin.createUser({ email: "anna.rossi@liceovoltacomo.edu.it", password: stack.env.TEACHER_INITIAL_PASSWORD, email_confirm: true, user_metadata: { full_name: "Anna Rossi" } });
    const teacherId = t.data.user.id;
    await db.query("update public.teachers set must_change_password = false where id = $1", [teacherId]);

    browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
      args: ["--no-sandbox", "--no-proxy-server", "--lang=it-IT", "--host-resolver-rules=MAP accounts.google.com 127.0.0.1, MAP *.googleapis.com 127.0.0.1"],
    });
    const newContext = (mobile = false) =>
      browser.newContext({ ignoreHTTPSErrors: true, reducedMotion: "reduce", acceptDownloads: true, locale: "it-IT", timezoneId: "Europe/Rome", ...(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1360, height: 900 } }) });
    const settle = (page, ms = 700) => page.waitForTimeout(ms);
    const loginTeacher = async (page) => {
      await page.goto(`${APP}/accesso/docenti`);
      await page.fill("#teacher-email", "anna.rossi@liceovoltacomo.edu.it");
      await page.fill("#teacher-password", stack.env.TEACHER_INITIAL_PASSWORD);
      await page.getByRole("button", { name: "Accedi all'area docenti" }).click();
      await page.waitForURL(`${APP}/docenti`, { timeout: 20000 });
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
    const toast = (page, text) => page.getByText(text).waitFor({ timeout: 15000 }).then(() => true, () => false);

    const ctx = await newContext();
    const page = await ctx.newPage();
    await loginTeacher(page);

    // =====================================================================
    // 1. Dashboard
    // =====================================================================
    await settle(page);
    const stats = await page.getByTestId("dashboard-stats").innerText();
    const registered = (await one("select count(*)::int n from public.students where registered_at is not null and is_active")).n;
    check("1 · Dashboard", "totale iscritti letto dal database", stats.includes(registered.toLocaleString("it-IT")), stats.replace(/\n/g, " | "));
    check("1 · Dashboard", "studenti in lista d'attesa (3)", /In attesa\s*\n?\s*3/i.test(stats));
    check("1 · Dashboard", "giornate complete (1)", /Complete\s*\n?\s*1\b/i.test(stats));
    check("1 · Dashboard", "pulsante «INVIA COMUNICAZIONE AGLI ISCRITTI»", (await page.getByRole("link", { name: "INVIA COMUNICAZIONE AGLI ISCRITTI" }).count()) === 1);
    check("1 · Dashboard", "prossime giornate con prenotati e lista d'attesa", (await page.locator("li").filter({ hasText: "giovedì 26 novembre" }).filter({ hasText: "12/50" }).count()) >= 1);
    check("1 · Dashboard", "grafico dell'occupazione", (await page.getByLabel("Occupazione delle prossime giornate").count()) === 1);
    await page.screenshot({ path: join(SHOTS, "dashboard.png"), fullPage: true });
    const mCtx = await newContext(true);
    const mPage = await mCtx.newPage();
    await loginTeacher(mPage);
    await settle(mPage);
    await mPage.screenshot({ path: join(SHOTS, "dashboard-smartphone.png"), fullPage: true });

    // =====================================================================
    // 2. Calendario: iscritti, posti e orario della singola giornata
    // =====================================================================
    await page.goto(`${APP}/docenti/calendario`);
    await openDay(page, D1);
    await settle(page);
    const editor = page.getByRole("region", { name: "Modifica giornata" });
    const edText = await editor.innerText();
    check("2 · Calendario", "iscritti (12) e posti disponibili (38) della giornata", /Iscritti\s*\n?\s*12/i.test(edText) && /Liberi\s*\n?\s*38/i.test(edText), edText.slice(0, 200).replace(/\n/g, " | "));
    await page.fill("#day-opens", "14:30");
    await page.fill("#day-closes", "16:00");
    await page.getByRole("button", { name: "Salva modifiche" }).click();
    check("2 · Calendario", "orario della giornata modificato dall'interfaccia", await toast(page, "Le modifiche sono attive."));
    const d1 = await one("select to_char(opens_at, 'HH24:MI') o, to_char(closes_at, 'HH24:MI') c from public.school_days where day = $1", [D1]);
    check("2 · Calendario", "nuovo orario 14:30–16:00 salvato nel database", d1.o === "14:30" && d1.c === "16:00", JSON.stringify(d1));
    check("7 · Registro", "cambio di orario registrato", (await logCount("orario_giornata")) === 1);

    // =====================================================================
    // 3. Chiusura con conferma e comunicazione personalizzata (prenotati + lista)
    // =====================================================================
    await openDay(page, D2);
    await settle(page);
    await page.locator('label[for="day-open"]').click();
    await page.fill("#day-reason", "Assemblea d'istituto");
    await page.getByRole("button", { name: "Chiudi la giornata" }).click();
    const sheet = page.getByRole("dialog", { name: "Chiudere la giornata?" });
    await sheet.waitFor({ timeout: 10000 });
    const sheetText = await sheet.innerText();
    check("3 · Chiusura", "conferma prima di chiudere una giornata con prenotazioni", sheetText.includes("50 studenti prenotati") && sheetText.includes("3 in lista d'attesa"), sheetText.slice(0, 160));
    check("3 · Chiusura", "numero di studenti coinvolti (53)", /Comunicazione a 53 studenti/i.test(sheetText));
    await sheet.locator('input[name="closure-notice"][value="custom"]').check();
    const msg = await page.inputValue("#closure-message");
    check("3 · Chiusura", "messaggio personalizzabile già precompilato con il motivo", msg.includes("Assemblea d'istituto"));
    await page.fill("#closure-subject", "Chiusura straordinaria di lunedì");
    await page.fill("#closure-message", "l'aula studio lunedì resterà chiusa per l'assemblea d'istituto.\nCi scusiamo per il disagio.");
    await page.getByText("Le modifiche sono attive.").waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
    await page.screenshot({ path: join(SHOTS, "chiusura-conferma.png") });
    await sheet.getByRole("button", { name: "Conferma chiusura" }).click();
    check("3 · Chiusura", "giornata chiusa con 53 studenti avvisati", await toast(page, "Prenotazioni bloccate. 53 studenti avvisati per email."));
    const d2 = await one("select is_open, closure_reason from public.school_days where day = $1", [D2]);
    check("3 · Chiusura", "chiusura e motivo salvati nel database", d2.is_open === false && d2.closure_reason === "Assemblea d'istituto");
    await cron();
    const custom = await waitUntil(async () => mailsWith("Chiusura straordinaria di lunedì").length === 53);
    check("3 · Chiusura", "53 email personalizzate inviate realmente (50 prenotati + 3 in lista)", custom, String(mailsWith("Chiusura straordinaria di lunedì").length));
    const toWaiter = mailsWith("Chiusura straordinaria di lunedì").find((m) => m.to === `attesa50@stud.liceovoltacomo.edu.it`) ?? mailsWith("Chiusura straordinaria di lunedì").find((m) => m.to.startsWith("attesa"));
    check("3 · Chiusura", "anche gli studenti in lista d'attesa ricevono il messaggio", Boolean(toWaiter) && toWaiter.html.includes("assemblea d&#39;istituto"));
    check("3 · Chiusura", "nessun avviso automatico in più (niente doppie email)", mailsWith("Aula studio chiusa").length === 0);
    const closedLog = await one("select details from public.audit_log where action = 'docente.giornata_chiusa'");
    check("7 · Registro", "chiusura registrata con motivo, coinvolti e comunicazione", closedLog?.details.motivo === "Assemblea d'istituto" && closedLog.details.prenotati === 50 && closedLog.details.in_attesa === 3 && closedLog.details.comunicazione === "custom" && closedLog.details.destinatari === 53, JSON.stringify(closedLog?.details));
    const annClosure = await one("select recipients_count from public.announcements where title = 'Chiusura straordinaria di lunedì'");
    check("4 · Comunicazioni", "la comunicazione di chiusura è salvata con i suoi destinatari", annClosure?.recipients_count === 53);
    await page.screenshot({ path: join(SHOTS, "giornata-chiusa.png"), fullPage: true });

    // riapertura
    await page.getByRole("button", { name: "Riapri giornata" }).click();
    check("3 · Chiusura", "giornata riaperta dall'interfaccia", await toast(page, "La giornata è di nuovo prenotabile."));
    check("3 · Chiusura", "riapertura salvata: le prenotazioni tornano valide", (await one("select is_open from public.school_days where day = $1", [D2])).is_open === true && (await one("select count(*)::int n from public.bookings b join public.school_days d on d.id = b.school_day_id where d.day = $1 and b.status = 'confirmed'", [D2])).n === 50);
    check("7 · Registro", "riapertura registrata", (await logCount("giornata_riaperta")) === 1);

    // chiusura senza email
    const before = mail.messages.length;
    await openDay(page, D3);
    await settle(page);
    await page.locator('label[for="day-open"]').click();
    await page.fill("#day-reason", "Elezioni scolastiche");
    await page.getByRole("button", { name: "Chiudi la giornata" }).click();
    await page.getByRole("dialog").locator('input[name="closure-notice"][value="none"]').check();
    await page.getByRole("button", { name: "Conferma chiusura" }).click();
    check("3 · Chiusura", "chiusura senza email: scelta rispettata", await toast(page, "Prenotazioni bloccate. Nessuna email inviata."));
    await cron();
    await sleep(800);
    check("3 · Chiusura", "nessuna email inviata ai 4 prenotati", mail.messages.length === before);

    // =====================================================================
    // 5. Elenco iscritti: ricerca, filtro, ordinamento, esportazione, annullamento
    // =====================================================================
    await page.goto(`${APP}/docenti/iscritti?giorno=${D1}`);
    await settle(page);
    const rows = page.getByTestId("roster-row");
    check("5 · Iscritti", "elenco della giornata con 12 studenti", (await rows.count()) === 12);
    const first = await rows.first().innerText();
    check("5 · Iscritti", "ordine alfabetico per cognome (primo: BIANCHI Giulia)", /bianchi/i.test(first) && first.includes("Giulia"), first.replace(/\n/g, " | "));
    const tableText = await page.locator("table").innerText();
    check("5 · Iscritti", "colonne nome, cognome, classe, email, data e ora", tableText.includes("4B") && tableText.includes("giulia.bianchi@stud.liceovoltacomo.edu.it") && /\d{2}:\d{2}/.test(tableText));
    await page.fill("#roster-search", "ross");
    check("5 · Iscritti", "ricerca per cognome", (await rows.count()) === 1 && (await rows.first().innerText()).includes("Marco"));
    await page.fill("#roster-search", "giulia");
    check("5 · Iscritti", "ricerca per nome", (await rows.count()) === 1);
    await page.fill("#roster-search", "");
    await page.selectOption("#roster-class", "4B");
    check("5 · Iscritti", "filtro per classe (4B: 4 studenti)", (await rows.count()) === 4);
    await page.selectOption("#roster-class", "");
    await page.selectOption("#roster-sort", "firstName");
    check("5 · Iscritti", "ordinamento per nome (primo: Andrea)", (await rows.first().innerText()).includes("Andrea"));
    await page.selectOption("#roster-sort", "lastName");
    await page.screenshot({ path: join(SHOTS, "iscritti.png"), fullPage: true });

    // esportazione CSV (dal pulsante, come la scarica il docente)
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Esporta CSV" }).click()]);
    const csvPath = join(SHOTS, download.suggestedFilename());
    await download.saveAs(csvPath);
    const csv = await (await import("node:fs/promises")).readFile(csvPath, "utf8");
    const lines = csv.replace(/^﻿/, "").trim().split(/\r\n/);
    check("5 · Esportazione", "CSV scaricato con nome della giornata", download.suggestedFilename() === `bibliovolta-iscritti-${D1}.csv`);
    check("5 · Esportazione", "CSV per Excel italiano (BOM, separatore ;)", csv.startsWith("﻿") && lines[0] === '"Cognome";"Nome";"Classe";"Email";"Data prenotazione";"Ora prenotazione"', lines[0]);
    check("5 · Esportazione", "CSV con tutti i 12 iscritti in ordine alfabetico", lines.length === 13 && lines[1].startsWith('"Bianchi";"Giulia";"4B";"giulia.bianchi@stud.liceovoltacomo.edu.it"'), lines[1]);
    const xlsxRes = await page.request.get(`${APP}/docenti/iscritti/esporta?giorno=${D1}&formato=xlsx`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await xlsxRes.body());
    const ws = wb.getWorksheet("Iscritti");
    check("5 · Esportazione", "file Excel valido con intestazione e 12 righe", xlsxRes.headers()["content-type"].includes("spreadsheetml") && ws.getRow(3).getCell(1).value === "Cognome" && ws.rowCount === 15 && ws.getRow(4).getCell(1).value === "Bianchi", `${ws?.rowCount}`);
    writeFileSync(join(SHOTS, `bibliovolta-iscritti-${D1}.xlsx`), await xlsxRes.body());
    const anon = await fetch(`${APP}/docenti/iscritti/esporta?giorno=${D1}&formato=csv`, { redirect: "manual" });
    check("5 · Esportazione", "esportazione negata senza accesso docente", anon.status === 307 || anon.status === 403, String(anon.status));

    // annullamento manuale con motivazione
    const davide = people.find((p) => p.last === "Bruno");
    await page.getByRole("button", { name: "Annulla la prenotazione di Davide Bruno" }).click();
    const cs = page.getByRole("dialog", { name: "Annullare la prenotazione?" });
    check("5 · Annullamento", "il motivo è obbligatorio", await cs.getByRole("button", { name: "Annulla prenotazione" }).isDisabled());
    await page.fill("#cancel-reason", "Uscita didattica della classe 4B");
    await page.screenshot({ path: join(SHOTS, "annullamento.png") });
    await cs.getByRole("button", { name: "Annulla prenotazione" }).click();
    check("5 · Annullamento", "annullamento confermato a schermo", await toast(page, "Davide Bruno riceverà un'email con il motivo."));
    const cancelled = await one("select b.status, b.cancel_reason, b.cancelled_by from public.bookings b join public.school_days d on d.id = b.school_day_id where b.student_id = $1 and d.day = $2", [davide.id, D1]);
    check("5 · Annullamento", "prenotazione annullata nel database con motivo e docente", cancelled.status === "cancelled" && cancelled.cancel_reason === "Uscita didattica della classe 4B" && cancelled.cancelled_by === teacherId, JSON.stringify(cancelled));
    await cron();
    const cMail = await mail.waitFor(davide.email, "Prenotazione annullata");
    check("5 · Annullamento", "email allo studente con il motivo", Boolean(cMail) && cMail.html.includes("Uscita didattica della classe 4B"));
    check("7 · Registro", "annullamento manuale registrato", (await logCount("prenotazione_annullata")) === 1);
    await settle(page);
    check("5 · Annullamento", "l'elenco si aggiorna (11 prenotati)", await waitUntil(async () => (await rows.count()) === 11));

    // =====================================================================
    // 4. Comunicazioni agli iscritti (esito per destinatario, errori, nuovo invio)
    // =====================================================================
    await page.goto(`${APP}/docenti/comunicazioni?giorno=${D1}`);
    await settle(page);
    check("4 · Comunicazioni", "destinatari della giornata: 11 prenotati", (await page.getByTestId("recipients-estimate").innerText()).includes("11"));
    await page.getByRole("button", { name: "Modifica orario" }).click();
    check("4 · Comunicazioni", "modello «Modifica orario» applicato", (await page.inputValue("#ann-subject")) === "Cambio di orario dell'aula studio");
    await page.fill("#ann-body", "giovedì l'aula studio sarà aperta dalle 14:30 alle 16:00.\nLa tua prenotazione resta valida.");
    const frame = page.frameLocator('iframe[title="Anteprima dell\'email"]');
    check("4 · Comunicazioni", "anteprima dell'email aggiornata", await frame.getByText("dalle 14:30 alle 16:00").waitFor({ timeout: 5000 }).then(() => true, () => false));
    await page.screenshot({ path: join(SHOTS, "comunicazione-composizione.png"), fullPage: true });
    await page.getByRole("button", { name: "INVIA COMUNICAZIONE AGLI ISCRITTI" }).click();
    const confirmSheet = page.getByRole("dialog", { name: "Confermi l'invio?" });
    await confirmSheet.waitFor({ timeout: 10000 });
    check("4 · Comunicazioni", "conferma con il numero esatto di destinatari (dal database)", (await page.getByTestId("confirm-count").innerText()) === "11");
    await page.screenshot({ path: join(SHOTS, "comunicazione-conferma.png") });
    await confirmSheet.getByRole("button", { name: "Invia a 11 studenti" }).click();
    check("4 · Comunicazioni", "invio avviato", await toast(page, "11 email messe in coda."));
    await cron();
    const delivered = await waitUntil(async () => mailsWith("Cambio di orario dell'aula studio").length === 10);
    check("4 · Comunicazioni", "10 email consegnate al servizio di invio", delivered, String(mailsWith("Cambio di orario dell'aula studio").length));
    check("4 · Comunicazioni", "l'indirizzo rifiutato dal servizio non riceve l'email", mail.rejected.filter((r) => r.subject.includes("Cambio di orario")).length === 1);
    check("4 · Comunicazioni", "lo studente annullato non riceve la comunicazione", mailsWith("Cambio di orario").every((m) => m.to !== davide.email));
    const ann = await one("select id, recipients_count from public.announcements where title = 'Cambio di orario dell''aula studio'");
    const outcome = (await db.query("select email_status::text s, count(*)::int n from public.announcement_deliveries where announcement_id = $1 group by 1", [ann.id])).rows;
    const by = Object.fromEntries(outcome.map((r) => [r.s, r.n]));
    check("4 · Comunicazioni", "esito registrato per ogni destinatario: 10 inviate, 1 non recapitata", by.sent === 10 && by.failed === 1 && ann.recipients_count === 11, JSON.stringify(by));
    const failedRow = await one("select d.email_error, d.email_provider_id from public.announcement_deliveries d join public.students s on s.id = d.student_id where d.announcement_id = $1 and s.last_name = 'Rifiutata'", [ann.id]);
    check("4 · Comunicazioni", "errore del servizio email salvato", String(failedRow.email_error).includes("Indirizzo del destinatario non valido"));
    const okRow = await one("select d.email_provider_id from public.announcement_deliveries d join public.students s on s.id = d.student_id where d.announcement_id = $1 and s.last_name = 'Bianchi'", [ann.id]);
    check("4 · Comunicazioni", "id del messaggio del servizio email salvato per le consegnate", mail.messages.some((m) => m.id === okRow.email_provider_id));
    await page.reload();
    await settle(page);
    const item = page.getByTestId("announcement-item").filter({ hasText: "Cambio di orario dell'aula studio" });
    check("4 · Comunicazioni", "storico: 10 inviate e 1 non recapitata", (await item.getByTestId("sent-count").innerText()).includes("10") && (await item.getByTestId("failed-count").innerText()).includes("1"));
    check("4 · Comunicazioni", "storico: indirizzo e motivo dell'errore", (await item.innerText()).includes("rita.rifiutata@stud.liceovoltacomo.edu.it"));
    await page.screenshot({ path: join(SHOTS, "comunicazioni-storico.png"), fullPage: true });
    await item.getByRole("button", { name: "Riprova l'invio" }).click();
    check("4 · Comunicazioni", "nuovo invio delle email non recapitate", await toast(page, "1 email verranno reinviate."));
    await cron();
    check("4 · Comunicazioni", "il nuovo invio viene davvero tentato", await waitUntil(async () => mail.rejected.filter((r) => r.subject.includes("Cambio di orario")).length === 2));
    check("7 · Registro", "comunicazione e nuovo invio registrati", (await logCount("comunicazione_inviata")) >= 1 && (await logCount("comunicazione_reinvio")) === 1);

    // solo lista d'attesa
    await page.goto(`${APP}/docenti/comunicazioni?giorno=${D2}`);
    await settle(page);
    await page.locator('label[for="ann-bookings"]').click();
    await page.locator('label[for="ann-waitlist"]').click();
    check("4 · Comunicazioni", "destinatari solo lista d'attesa: 3", (await page.getByTestId("recipients-estimate").innerText()).includes("3"));
    await page.getByRole("button", { name: "Avviso urgente" }).click();
    await page.fill("#ann-subject", "Posti in arrivo per lunedì");
    await page.fill("#ann-body", "è probabile che si liberino posti: tieni d'occhio la tua email.");
    await page.getByRole("button", { name: "INVIA COMUNICAZIONE AGLI ISCRITTI" }).click();
    await page.getByRole("dialog", { name: "Confermi l'invio?" }).getByRole("button", { name: "Invia a 3 studenti" }).click();
    await toast(page, "3 email messe in coda.");
    await cron();
    check("4 · Comunicazioni", "comunicazione inviata solo agli studenti in lista d'attesa", await waitUntil(async () => mailsWith("Posti in arrivo per lunedì").length === 3) && mailsWith("Posti in arrivo per lunedì").every((m) => m.to.startsWith("attesa")));

    // controlli lato server
    const sTok = tokenFor(people[0].id);
    const tTok = tokenFor(teacherId);
    const studentTry = await rpc(sTok, "send_announcement", { p_school_day_id: await dayId(D1), p_include_bookings: true, p_include_waitlist: false, p_subject: "Prova", p_body: "Messaggio di prova", p_category: "altro" });
    check("8 · Sicurezza", "uno studente non può inviare comunicazioni", studentTry.status >= 400);
    const studentClose = await rpc(sTok, "teacher_update_day", { p_school_day_id: await dayId(D1), p_is_open: false, p_capacity: 50, p_opens_at: "14:15", p_closes_at: "16:30", p_note: null, p_closure_reason: "x" });
    check("8 · Sicurezza", "uno studente non può chiudere giornate", studentClose.status >= 400 && (await one("select is_open from public.school_days where day = $1", [D1])).is_open === true);
    const studentCancel = await rpc(sTok, "teacher_cancel_booking", { p_booking_id: (await one("select id from public.bookings where student_id = $1", [people[1].id])).id, p_reason: "prova" });
    check("8 · Sicurezza", "uno studente non può annullare prenotazioni altrui", studentCancel.status >= 400);
    const emptySubject = await rpc(tTok, "send_announcement", { p_school_day_id: await dayId(D1), p_include_bookings: true, p_include_waitlist: false, p_subject: " ", p_body: "Messaggio", p_category: "altro" });
    check("8 · Sicurezza", "oggetto vuoto rifiutato anche chiamando direttamente il database", emptySubject.status >= 400);
    const noReason = await rpc(tTok, "teacher_cancel_booking", { p_booking_id: (await one("select id from public.bookings where student_id = $1", [people[1].id])).id, p_reason: " " });
    check("8 · Sicurezza", "annullamento senza motivo rifiutato dal database", noReason.status >= 400);

    // =====================================================================
    // 6. Statistiche
    // =====================================================================
    await page.goto(`${APP}/docenti/statistiche`);
    await settle(page);
    const total = (await one("select count(*)::int n from public.bookings where status = 'confirmed'")).n;
    const statsText = await page.locator("main").innerText();
    check("6 · Statistiche", "prenotazioni totali uguali al database", statsText.includes(total.toLocaleString("it-IT")), String(total));
    check("6 · Statistiche", "media giornaliera, occupazione e lista d'attesa", /media giornaliera/i.test(statsText) && /occupazione/i.test(statsText) && /in lista d'attesa/i.test(statsText));
    check("6 · Statistiche", "giornate più frequentate (lunedì 30 novembre in testa)", /lun 30 nov/i.test(statsText));
    check("6 · Statistiche", "classi più rappresentate (5B in testa)", statsText.indexOf("5B") > -1 && statsText.indexOf("5B") < statsText.indexOf("1A"));
    await page.screenshot({ path: join(SHOTS, "statistiche.png"), fullPage: true });

    // =====================================================================
    // 7. Registro delle operazioni
    // =====================================================================
    await page.goto(`${APP}/docenti/registro`);
    await settle(page);
    const entries = page.getByTestId("log-entry");
    const dbEntries = (await one("select count(*)::int n from public.audit_log where action like 'docente.%'")).n;
    check("7 · Registro", "tutte le operazioni dei docenti elencate", (await entries.count()) === dbEntries, `${await entries.count()} / ${dbEntries}`);
    const logText = (await page.locator("main").innerText()).toLowerCase();
    check("7 · Registro", "descrizioni leggibili con autore", logText.includes("chiusa la giornata di lunedì 30 novembre") && logText.includes("annullata la prenotazione di davide bruno (4b)") && logText.includes("anna rossi"));
    await page.selectOption("#log-category", "comunicazioni");
    check("7 · Registro", "filtro per tipo di operazione", (await entries.count()) === (await one("select count(*)::int n from public.audit_log where action in ('docente.comunicazione_inviata','docente.comunicazione_reinvio')")).n);
    await page.selectOption("#log-category", "");
    await page.fill("#log-search", "Bruno");
    check("7 · Registro", "ricerca nel registro", (await entries.count()) === 1);
    await page.fill("#log-search", "");
    await page.screenshot({ path: join(SHOTS, "registro.png"), fullPage: true });

    // impostazioni: cambio dell'orario generale registrato
    await page.goto(`${APP}/docenti/calendario`);
    await settle(page);
    await page.fill("#hours-open", "14:20");
    await page.locator("form").filter({ has: page.locator("#hours-open") }).locator('button[type="submit"]').click();
    check("7 · Registro", "cambio dell'orario generale registrato", await waitUntil(async () => (await logCount("orario_generale")) === 1));
    await page.screenshot({ path: join(SHOTS, "calendario.png"), fullPage: true });
    await mPage.goto(`${APP}/docenti/iscritti?giorno=${D1}`);
    await settle(mPage);
    await mPage.screenshot({ path: join(SHOTS, "iscritti-smartphone.png"), fullPage: true });
    await mPage.goto(`${APP}/docenti/comunicazioni`);
    await settle(mPage);
    await mPage.screenshot({ path: join(SHOTS, "comunicazioni-smartphone.png"), fullPage: true });

    // =====================================================================
    // 9. Nessun dato dimostrativo nelle pagine reali
    // =====================================================================
    let demo = false;
    for (const p of ["", "/calendario", "/iscritti", "/comunicazioni", "/statistiche", "/registro"]) {
      await page.goto(`${APP}/docenti${p}`);
      await settle(page, 400);
      if (/Esempio|dimostrativ/i.test(await page.locator("main").innerText())) demo = true;
    }
    check("9 · Dati reali", "le pagine docenti non mostrano dati dimostrativi", !demo);
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
  writeFileSync(join(SHOTS, "risultati.json"), JSON.stringify(results, null, 2));
  console.log(`\n${results.length - failed.length}/${results.length} verifiche superate`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
