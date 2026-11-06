/**
 * BIBLIOVOLTA · Verifica grafica su smartphone, tablet e computer (Fase 7)
 *
 *   npm run test:ui        (Linux, root: come test:auth)
 *
 * Apre tutte le pagine reali (pubbliche, area studenti, area docenti) con
 * dati veri nel database su tre dispositivi e controlla: pagina caricata,
 * titolo presente, nessuno scorrimento orizzontale, nessun errore nella
 * console, nessuna risorsa mancante, immagini caricate, fotografia
 * originale della biblioteca e logo della scuola dove previsti, menu di
 * navigazione adatto al dispositivo. Salva una schermata per ogni caso.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium, devices } from "playwright";
import { GOOGLE_TEST_CLIENT, startStack } from "./local-stack/stack.mjs";
import { startMockGoogle } from "./local-stack/mock-google.mjs";
import { startMockResend } from "./local-stack/mock-resend.mjs";

const ROOT = process.cwd();
const APP = "http://localhost:3400";
const OUT = join(ROOT, ".local-stack", "screens-ui");
const CRON_SECRET = "test-cron-secret-0123456789abcdef";
const results = [];
const check = (group, name, ok, detail = "") => {
  results.push({ group, name, ok: Boolean(ok), detail });
  console.log(`${ok ? "✔" : "✘"} [${group}] ${name}${!ok && detail ? `  →  ${detail}` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (cmd, args, env) =>
  new Promise((ok, ko) => spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: "ignore" }).on("exit", (c) => (c === 0 ? ok() : ko(new Error(`${cmd} ${c}`)))));

const DEVICES = {
  smartphone: { ...devices["iPhone 13"], defaultBrowserType: undefined },
  tablet: { ...devices["iPad (gen 7)"], defaultBrowserType: undefined },
  computer: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};
const ONLY = process.argv.find((a) => a.startsWith("--solo="))?.slice(7);
const PUBLIC = [
  ["/", "Homepage", { photo: true, logo: true }],
  ["/accesso", "Accesso studenti", { photo: true, logo: true }],
  ["/accesso/docenti", "Accesso docenti", { photo: "computer", logo: true }], // foto solo su schermi grandi (grafica approvata)
  ["/privacy", "Informativa privacy", {}],
];
const STUDENT = [
  ["/studente", "Area personale", { photo: true }],
  ["/studente/calendario", "Calendario studenti", {}],
  ["/studente/prenotazioni", "Le mie prenotazioni", {}],
  ["/studente/attesa", "Le mie liste d'attesa", {}],
];
const TEACHER = [
  ["/docenti", "Dashboard docenti", {}],
  ["/docenti/calendario", "Calendario docenti", {}],
  ["/docenti/lista-attesa", "Lista d'attesa (docenti)", {}],
  ["/docenti/iscritti?giorno=2026-11-30", "Iscritti", {}],
  ["/docenti/comunicazioni", "Comunicazioni", {}],
  ["/docenti/statistiche", "Statistiche", {}],
  ["/docenti/registro", "Registro", {}],
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const google = await startMockGoogle({ dir: join(ROOT, ".local-stack", "mock-google"), clientId: GOOGLE_TEST_CLIENT.id, clientSecret: GOOGLE_TEST_CLIENT.secret });
  const mail = await startMockResend();
  const stack = await startStack({ fresh: true, googleCaBundle: google.caBundle });
  const env = { ...stack.env, NEXT_DIST_DIR: ".next-test", NEXT_TELEMETRY_DISABLED: "1", RESEND_API_KEY: "re_test_key", RESEND_BASE_URL: mail.url, EMAIL_FROM: "BIBLIOVOLTA <bibliovolta@liceovoltacomo.edu.it>", CRON_SECRET };
  const db = stack.db;
  let server;
  let browser;
  try {
    if (!process.argv.includes("--no-build") || !existsSync(join(ROOT, ".next-test"))) {
      console.log("Compilo l'app per il test…");
      await run("npx", ["next", "build"], env);
    }
    if (await fetch(APP).then(() => true, () => false)) throw new Error("La porta 3400 è occupata.");
    server = spawn(join(ROOT, "node_modules", ".bin", "next"), ["start", "-p", "3400"], { cwd: ROOT, env: { ...process.env, ...env }, stdio: "ignore", detached: true });
    for (let i = 0; i < 120 && !(await fetch(APP).then(() => true, () => false)); i++) await sleep(500);

    // ---------------- dati realistici ----------------
    const API = stack.env.NEXT_PUBLIC_SUPABASE_URL;
    const ANON = stack.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const tokenFor = (id) => stack.sign({ sub: id, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 });
    const rpc = (token, fn, body = {}) => fetch(`${API}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: ANON, authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json().catch(() => null));
    const dayId = async (d) => (await db.query("select id from public.school_days where day = $1", [d])).rows[0].id;
    const NAMES = ["Bianchi", "Rossi", "Colombo", "Ferrari", "Ricci", "Esposito", "Romano", "Gallo", "Conti", "Bruno", "Greco", "Marino", "Costa", "Fontana", "Rizzo"];
    const FIRST = ["Giulia", "Marco", "Sara", "Luca", "Elena", "Paolo", "Chiara", "Andrea", "Francesca", "Davide"];
    const CLASSES = ["1A", "2B", "3C", "4A", "4B", "5A", "5C"];
    const students = [];
    for (let i = 0; i < 60; i++) {
      const first = FIRST[i % FIRST.length];
      const last = NAMES[i % NAMES.length];
      const r = await db.query(
        `insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
         values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', $1,
                 '{"provider":"google","providers":["google"]}', '{"email_verified":true}', now(), now(), now()) returning id`, [`${first}.${last}${i}`.toLowerCase() + "@stud.liceovoltacomo.edu.it"]);
      await db.query("update public.students set first_name = $2, last_name = $3, class_name = $4, registered_at = now() where id = $1", [r.rows[0].id, first, last, CLASSES[i % CLASSES.length]]);
      students.push(r.rows[0].id);
    }
    const plan = { "2026-11-16": 31, "2026-11-17": 46, "2026-11-18": 22, "2026-11-23": 38, "2026-11-25": 47, "2026-11-30": 50, "2026-12-02": 18 };
    for (const [day, n] of Object.entries(plan)) {
      const id = await dayId(day);
      await db.query("insert into public.bookings (student_id, school_day_id, created_by) select s, $2, s from unnest($1::uuid[]) s", [students.slice(0, n), id]);
    }
    for (const s of students.slice(50, 54)) await rpc(tokenFor(s), "join_waitlist", { p_school_day_id: await dayId("2026-11-30") });
    const admin = createClient(API, stack.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    await admin.from("teacher_invitations").upsert({ email: "anna.rossi@liceovoltacomo.edu.it", full_name: "Anna Rossi", is_admin: true });
    const t = await admin.auth.admin.createUser({ email: "anna.rossi@liceovoltacomo.edu.it", password: stack.env.TEACHER_INITIAL_PASSWORD, email_confirm: true });
    await db.query("update public.teachers set must_change_password = false where id = $1", [t.data.user.id]);
    const tTok = tokenFor(t.data.user.id);
    await rpc(tTok, "send_announcement", { p_school_day_id: await dayId("2026-11-25"), p_include_bookings: true, p_include_waitlist: false, p_subject: "Uscita anticipata alle 16:00", p_body: "Mercoledì l'aula studio chiuderà alle 16:00 per il collegio docenti.", p_category: "modifica_orario" });
    await rpc(tTok, "teacher_update_day", { p_school_day_id: await dayId("2026-12-07"), p_is_open: false, p_capacity: 50, p_opens_at: "14:15", p_closes_at: "16:30", p_note: null, p_closure_reason: "Ponte dell'Immacolata", p_notice: "none" });
    await fetch(`${APP}/api/cron/notifications`, { headers: { authorization: `Bearer ${CRON_SECRET}` } });

    browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
      args: ["--no-sandbox", "--no-proxy-server", "--lang=it-IT", "--host-resolver-rules=MAP accounts.google.com 127.0.0.1, MAP *.googleapis.com 127.0.0.1"],
    });
    const base = { ignoreHTTPSErrors: true, reducedMotion: "reduce", locale: "it-IT", timezoneId: "Europe/Rome" };

    // sessioni: studente (Google) con prenotazioni e lista d'attesa, docente (password)
    const sLogin = await browser.newContext(base);
    const sp = await sLogin.newPage();
    google.useAccount({ email: "giulia.verdi@stud.liceovoltacomo.edu.it", email_verified: true, name: "Giulia Verdi", given_name: "Giulia", family_name: "Verdi" });
    await sp.goto(`${APP}/accesso`);
    await sp.getByRole("button", { name: "Accedi con Google" }).click();
    await sp.waitForURL(`${APP}/registrazione`, { timeout: 20000 });
    for (const dev of ["smartphone", "tablet", "computer"]) {
      // anche la schermata di registrazione, su ogni dispositivo
      const c = await browser.newContext({ ...base, ...DEVICES[dev], storageState: await sLogin.storageState() });
      const p = await c.newPage();
      await p.goto(`${APP}/registrazione`, { waitUntil: "networkidle" });
      await p.screenshot({ path: join(OUT, `${dev}-registrazione.png`) });
      const ow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(`Registrazione · ${dev}`, "nessuno scorrimento orizzontale e logo visibile", ow <= 1 && (await p.locator('img[alt="Logo del Liceo A. Volta di Como"]').count()) > 0, `+${ow}px`);
      await c.close();
    }
    await sp.selectOption("#reg-year", "4");
    await sp.fill("#reg-section", "B");
    await sp.getByRole("button", { name: /Completa la registrazione/ }).click();
    await sp.waitForURL(`${APP}/studente`, { timeout: 20000 });
    const giulia = (await db.query("select id from public.students where email = 'giulia.verdi@stud.liceovoltacomo.edu.it'")).rows[0].id;
    await rpc(tokenFor(giulia), "book_seat", { p_school_day_id: await dayId("2026-11-16") });
    await rpc(tokenFor(giulia), "book_seat", { p_school_day_id: await dayId("2026-12-02") });
    await rpc(tokenFor(giulia), "join_waitlist", { p_school_day_id: await dayId("2026-11-30") });
    const studentState = await sLogin.storageState();
    const tLogin = await browser.newContext(base);
    const tp = await tLogin.newPage();
    await tp.goto(`${APP}/accesso/docenti`);
    await tp.fill("#teacher-email", "anna.rossi@liceovoltacomo.edu.it");
    await tp.fill("#teacher-password", stack.env.TEACHER_INITIAL_PASSWORD);
    await tp.getByRole("button", { name: "Accedi all'area docenti" }).click();
    await tp.waitForURL(`${APP}/docenti`, { timeout: 20000 });
    const teacherState = await tLogin.storageState();

    // ---------------- giro delle pagine ----------------
    const summary = [];
    for (const [dev, desc] of Object.entries(DEVICES)) {
      for (const [role, pages, state] of [["pubblico", PUBLIC, undefined], ["studente", STUDENT, studentState], ["docente", TEACHER, teacherState]]) {
        const ctx = await browser.newContext({ ...base, ...desc, ...(state ? { storageState: state } : {}) });
        for (const [path, label, expect] of pages) {
          if (ONLY && !path.includes(ONLY)) continue;
          const page = await ctx.newPage();
          const errors = [];
          const failed = [];
          page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
          page.on("pageerror", (e) => errors.push(e.message));
          page.on("response", (r) => r.url().startsWith(APP) && r.status() >= 400 && failed.push(`${r.status()} ${r.url().replace(APP, "")}`));
          const res = await page.goto(`${APP}${path}`, { waitUntil: "networkidle" });
          await page.waitForTimeout(400);
          const info = await page.evaluate(async () => {
            // carica anche le immagini "lazy" scorrendo la pagina
            for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
              window.scrollTo(0, y);
              await new Promise((r) => setTimeout(r, 60));
            }
            window.scrollTo(0, 0);
            await new Promise((r) => setTimeout(r, 200));
            for (const i of document.images) {
              if (i.complete || i.getClientRects().length === 0) continue;
              i.scrollIntoView({ block: "center" }); // le immagini "lazy" partono quando arrivano sullo schermo
              await new Promise((r) => { i.addEventListener("load", r); i.addEventListener("error", r); setTimeout(r, 4000); });
            }
            window.scrollTo(0, 0);
            const imgs = [...document.images].filter((i) => i.getClientRects().length > 0 && getComputedStyle(i).visibility !== "hidden"); // solo immagini visibili su questo dispositivo
            const offenders = [...document.querySelectorAll("body *")]
              .filter((el) => {
                if (el.getBoundingClientRect().right <= document.documentElement.clientWidth + 1) return false;
                // gli elementi dentro un contenitore scorrevole (tabelle) non allargano la pagina
                for (let p = el.parentElement; p; p = p.parentElement) {
                  const o = getComputedStyle(p).overflowX;
                  if (o === "auto" || o === "hidden" || o === "scroll" || o === "clip") return false;
                }
                return true;
              })
              .slice(-3)
              .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 50)}@${Math.round(el.getBoundingClientRect().right)}`);
            const spill = [...document.querySelectorAll("body *")]
              .filter((el) => getComputedStyle(el).overflowX === "visible" && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0)
              .slice(-4)
              .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}[${el.clientWidth}→${el.scrollWidth}]`);
            offenders.push(...spill);
            return {
              overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
              offenders,
              h1: document.querySelector("h1")?.textContent?.trim() ?? "",
              broken: imgs.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.alt || i.src),
              photo: imgs.find((i) => decodeURIComponent(i.currentSrc || i.src).includes("biblioteca-volta"))?.naturalWidth ?? 0,
              logo: imgs.some((i) => i.alt === "Logo del Liceo A. Volta di Como" && i.naturalWidth > 0),
            };
          });
          await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
          await page.waitForTimeout(300);
          const name = `${dev}-${role}-${path.replace(/[/?=]/g, "_").replace(/^_$/, "home").replace(/^_/, "")}`;
          await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: dev === "computer" || Boolean(ONLY) });
          const group = `${label} · ${dev}`;
          const ok = res && res.status() < 400 && new URL(page.url()).pathname === path.split("?")[0];
          check(group, "pagina aperta con il ruolo giusto", ok, `${res?.status()} ${page.url()}`);
          check(group, "titolo principale presente", info.h1.length > 0);
          check(group, "nessuno scorrimento orizzontale", info.overflow <= 1, `+${info.overflow}px ${info.offenders.join(" ")}`);
          check(group, "nessun errore nella console e nessuna risorsa mancante", errors.length === 0 && failed.length === 0, [...errors, ...failed].join(" | ").slice(0, 300));
          check(group, "tutte le immagini caricate", info.broken.length === 0, info.broken.join(", "));
          check(group, "riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina", (await page.getByTestId("app-credit").filter({ hasText: "App realizzata dal prof. Luca Romanò" }).count()) > 0);
          if (expect.photo === true || expect.photo === dev) check(group, "fotografia originale della biblioteca del Volta", info.photo > 0, String(info.photo));
          if (expect.logo) check(group, "logo del Liceo A. Volta", info.logo);
          summary.push({ dev, role, path, label, overflow: info.overflow, errors: errors.length + failed.length, shot: `${name}.png` });
          await page.close();
        }
        // navigazione adatta al dispositivo (solo aree riservate)
        if (role !== "pubblico") {
          const page = await ctx.newPage();
          await page.goto(`${APP}${role === "docente" ? "/docenti" : "/studente"}`, { waitUntil: "networkidle" });
          const nav = page.getByRole("navigation").filter({ visible: true });
          const links = await nav.getByRole("link").filter({ visible: true }).count();
          check(`Navigazione ${role} · ${dev}`, "menu visibile e utilizzabile", links >= (role === "docente" ? 5 : 3), String(links));
          await page.close();
        }
        await ctx.close();
      }
    }
    writeFileSync(join(OUT, "pagine.json"), JSON.stringify(summary, null, 2));
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
