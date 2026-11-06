/**
 * BIBLIOVOLTA · Test end-to-end dell'autenticazione (Fase 3)
 *
 *   npm run test:auth          (richiede root/Linux: usa /etc/hosts e la porta 443)
 *
 * Avvia uno stack Supabase locale con i programmi ufficiali (PostgreSQL,
 * Supabase Auth, PostgREST), compila e avvia l'app Next.js reale e la
 * guida con Chrome come farebbe un utente.
 * Google è sostituito dal provider di prova di scripts/local-stack/mock-google.mjs,
 * che risponde come Google OpenID Connect: tutto il resto (PKCE, verifica
 * dell'id_token, trigger del database, Server Actions, cookie, RLS) è il
 * codice vero dell'applicazione.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { GOOGLE_TEST_CLIENT, startStack } from "./local-stack/stack.mjs";
import { startMockGoogle } from "./local-stack/mock-google.mjs";

const ROOT = process.cwd();
const APP = "http://localhost:3400";
const SHOTS = join(ROOT, ".local-stack", "screens");
const results = [];
const check = (group, name, ok, detail = "") => {
  results.push({ group, name, ok: Boolean(ok), detail });
  console.log(`${ok ? "✔" : "✘"} [${group}] ${name}${!ok && detail ? `  →  ${detail}` : ""}`);
};

function run(cmd, args, env, opts = {}) {
  return new Promise((ok, ko) => {
    const p = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: opts.quiet ? "ignore" : "inherit" });
    p.on("exit", (c) => (c === 0 ? ok() : ko(new Error(`${cmd} ${args.join(" ")} → ${c}`))));
  });
}

async function waitFor(url, tries = 120) {
  for (let i = 0; i < tries; i++) {
    try {
      await fetch(url, { redirect: "manual" });
      return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${url} non risponde`);
}

/** Legge l'access token dalla sessione nei cookie httpOnly (il test può farlo, il JavaScript della pagina no). */
async function accessTokenOf(context) {
  const cookies = (await context.cookies()).filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name)).sort((a, b) => a.name.localeCompare(b.name));
  if (!cookies.length) return null;
  let value = cookies.map((c) => c.value).join("");
  if (value.startsWith("base64-")) value = Buffer.from(value.slice(7), "base64url").toString();
  return JSON.parse(value).access_token;
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  const google = await startMockGoogle({ dir: join(ROOT, ".local-stack", "mock-google"), clientId: GOOGLE_TEST_CLIENT.id, clientSecret: GOOGLE_TEST_CLIENT.secret });
  const stack = await startStack({ fresh: true, googleCaBundle: google.caBundle });
  const env = { ...stack.env, NEXT_DIST_DIR: ".next-test", NEXT_TELEMETRY_DISABLED: "1" };
  let server;
  let browser;
  try {
    if (!process.argv.includes("--no-build") || !existsSync(join(ROOT, ".next-test"))) {
      console.log("Compilo l'app per il test…");
      await run("npx", ["next", "build"], env, { quiet: true });
    }
    const busy = await fetch(APP).then(() => true, () => false);
    if (busy) throw new Error("La porta 3400 è già occupata: chiudi l'altro server prima del test.");
    server = spawn(join(ROOT, "node_modules", ".bin", "next"), ["start", "-p", "3400"], { cwd: ROOT, env: { ...process.env, ...env }, stdio: process.env.APP_LOG ? "inherit" : "ignore", detached: true });
    await waitFor(APP);

    const admin = createClient(stack.env.NEXT_PUBLIC_SUPABASE_URL, stack.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    // stessa procedura di scripts/create-teacher.ts
    const createTeacher = async (email, name, isAdmin = false) => {
      const inv = await admin.from("teacher_invitations").upsert({ email, full_name: name, is_admin: isAdmin });
      if (inv.error) throw inv.error;
      const { data, error } = await admin.auth.admin.createUser({
        email, password: stack.env.TEACHER_INITIAL_PASSWORD, email_confirm: true, user_metadata: { full_name: name },
      });
      if (error) throw error;
      return data.user;
    };
    await createTeacher("anna.rossi@liceovoltacomo.edu.it", "Anna Rossi", true);
    await createTeacher("maria.bianchi@liceovoltacomo.edu.it", "Maria Bianchi");

    browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
      args: ["--no-sandbox", "--no-proxy-server", "--host-resolver-rules=MAP accounts.google.com 127.0.0.1, MAP *.googleapis.com 127.0.0.1"],
    });
    const newContext = () => browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 860 }, reducedMotion: "reduce" });
    const rest = (token, path, init = {}) =>
      fetch(`${stack.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, {
        ...init,
        headers: { apikey: stack.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
      });
    const googleLogin = async (page, account) => {
      google.useAccount(account);
      await page.goto(`${APP}/accesso`);
      if (process.env.DEBUG_NAV) page.on("framenavigated", (f) => f === page.mainFrame() && console.log("   ↳", f.url().slice(0, 160)));
      await page.getByRole("button", { name: "Accedi con Google" }).click();
      // fine del giro Google → Supabase Auth → /auth/callback: un'altra pagina, oppure /accesso con un errore
      await page.waitForURL((u) => u.origin === APP && !u.pathname.startsWith("/auth/") && (u.pathname !== "/accesso" || u.searchParams.has("errore")), { timeout: 20000 });
      await page.waitForLoadState("networkidle");
    };
    const userExists = async (email) => (await stack.db.query("select 1 from auth.users where lower(email) = $1", [email])).rowCount > 0;

    // ------------------------------------------------------------------
    // 1. Accesso con account scolastico valido
    // ------------------------------------------------------------------
    const student = { email: "giulia.verdi@stud.liceovoltacomo.edu.it", email_verified: true, name: "Giulia Verdi", given_name: "Giulia", family_name: "Verdi", hd: "stud.liceovoltacomo.edu.it" };
    let ctx = await newContext();
    let page = await ctx.newPage();
    await googleLogin(page, student);
    const auth = google.authorizeRequests.at(-1) ?? {};
    check("1 · Accesso scolastico", "il pulsante porta a Google con dominio suggerito e scelta dell'account", auth.hd === "stud.liceovoltacomo.edu.it" && auth.prompt === "select_account" && auth.client_id === GOOGLE_TEST_CLIENT.id, JSON.stringify(auth));
    check("1 · Accesso scolastico", "dopo Google lo studente nuovo arriva alla registrazione", new URL(page.url()).pathname === "/registrazione", page.url());
    const sessionCookies = (await ctx.cookies()).filter((c) => c.name.startsWith("sb-"));
    check("1 · Accesso scolastico", "cookie di sessione httpOnly e SameSite=Lax", sessionCookies.length > 0 && sessionCookies.every((c) => c.httpOnly && c.sameSite === "Lax"), JSON.stringify(sessionCookies.map((c) => [c.name, c.httpOnly, c.sameSite])));
    check("1 · Accesso scolastico", "la sessione non è leggibile da JavaScript nella pagina", !(await page.evaluate(() => document.cookie)).includes("auth-token"));

    // ------------------------------------------------------------------
    // 3. Registrazione iniziale
    // ------------------------------------------------------------------
    const emailField = page.locator("#reg-email");
    check("3 · Registrazione", "email recuperata da Google e non modificabile", (await emailField.inputValue()) === student.email && (await emailField.getAttribute("readonly")) !== null && (await emailField.getAttribute("name")) === null);
    check("3 · Registrazione", "nome e cognome precompilati da Google", (await page.locator("#reg-first").inputValue()) === "Giulia" && (await page.locator("#reg-last").inputValue()) === "Verdi");
    await page.waitForTimeout(800); await page.screenshot({ path: join(SHOTS, "registrazione.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(800); await page.screenshot({ path: join(SHOTS, "registrazione-mobile.png"), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 860 });
    await page.getByRole("button", { name: /Completa la registrazione/ }).click();
    const yearError = await page.getByText("Scegli l'anno").waitFor({ timeout: 10000 }).then(() => true, () => false);
    if (!yearError) await page.waitForTimeout(800); await page.screenshot({ path: join(SHOTS, "debug-registrazione.png") });
    check("3 · Registrazione", "senza classe la registrazione viene rifiutata", new URL(page.url()).pathname === "/registrazione" && yearError);
    // tentativo di cambiare l'email manipolando la pagina: il server la ignora
    await page.evaluate(() => {
      const el = document.querySelector("#reg-email");
      el.removeAttribute("readonly");
      el.setAttribute("name", "email");
      el.value = "intruso@gmail.com";
    });
    await page.selectOption("#reg-year", "4");
    await page.fill("#reg-section", "b");
    await page.getByRole("button", { name: /Completa la registrazione/ }).click();
    await page.waitForURL(`${APP}/studente`, { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    const row = (await stack.db.query("select email, first_name, last_name, class_name, registered_at from public.students where email = $1", [student.email])).rows[0];
    check("3 · Registrazione", "dati salvati in Supabase (nome, cognome, classe 4B)", row && row.first_name === "Giulia" && row.last_name === "Verdi" && row.class_name === "4B" && row.registered_at, JSON.stringify(row));
    check("3 · Registrazione", "l'email manipolata nella pagina non viene salvata", (await stack.db.query("select 1 from public.students where email = 'intruso@gmail.com'")).rowCount === 0);
    const welcome = await page.getByRole("heading", { name: "Benvenuto, Giulia Verdi" }).waitFor({ timeout: 10000 }).then(() => true, () => false);
    check("3 · Area personale", "benvenuto con nome e cognome", welcome);
    check("3 · Area personale", "sezioni prenotazioni, liste d'attesa e comunicazioni", (await page.getByText("Le mie prenotazioni").count()) > 0 && (await page.getByText("Le mie liste d'attesa").count()) > 0 && (await page.getByRole("heading", { name: "Comunicazioni" }).count()) > 0);
    await page.waitForTimeout(800); await page.screenshot({ path: join(SHOTS, "area-personale.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(800); await page.screenshot({ path: join(SHOTS, "area-personale-mobile.png"), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 860 });
    await page.goto(`${APP}/registrazione`);
    check("3 · Registrazione", "chi è già registrato non rivede il modulo", new URL(page.url()).pathname === "/studente");

    // ------------------------------------------------------------------
    // 8. Protezione dei dati personali (chiamate dirette alle API Supabase)
    // ------------------------------------------------------------------
    const studentToken = await accessTokenOf(ctx);
    const meStudents = await (await rest(studentToken, "students?select=email")).json();
    check("8 · Dati personali", "lo studente legge solo il proprio profilo", Array.isArray(meStudents) && meStudents.length === 1 && meStudents[0].email === student.email, JSON.stringify(meStudents));
    check("8 · Dati personali", "lo studente non vede i docenti", JSON.stringify(await (await rest(studentToken, "teachers?select=email")).json()) === "[]");
    check("8 · Dati personali", "lo studente non vede il registro operazioni", JSON.stringify(await (await rest(studentToken, "audit_log?select=id")).json()) === "[]");
    check("8 · Dati personali", "lo studente non legge i tentativi di accesso", (await rest(studentToken, "auth_attempts?select=id")).status >= 400);
    const patch = await rest(studentToken, `students?email=eq.${encodeURIComponent(student.email)}`, { method: "PATCH", body: JSON.stringify({ class_name: "5A" }), headers: { prefer: "return=representation" } });
    const afterPatch = (await stack.db.query("select class_name from public.students where email = $1", [student.email])).rows[0];
    check("8 · Dati personali", "lo studente non può modificare il proprio profilo direttamente", afterPatch.class_name === "4B", `${patch.status}`);
    check("8 · Dati personali", "lo studente non può ripetere la registrazione via API", (await rest(studentToken, "rpc/complete_student_registration", { method: "POST", body: JSON.stringify({ p_first_name: "X", p_last_name: "Y", p_class_name: "1A" }) })).status >= 400);
    const anonStudents = await rest(stack.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, "students?select=email");
    check("8 · Dati personali", "senza accesso le API non restituiscono dati", anonStudents.status >= 400 || JSON.stringify(await anonStudents.json()) === "[]", String(anonStudents.status));
    const me = await page.request.get(`${APP}/api/me`);
    const meBody = await me.json();
    check("8 · Dati personali", "/api/me restituisce solo i dati di chi chiama", me.status() === 200 && meBody.role === "student" && meBody.email === student.email && !("id" in meBody), JSON.stringify(meBody));

    // ------------------------------------------------------------------
    // 7. Lo studente non entra nell'area docenti
    // ------------------------------------------------------------------
    for (const path of ["/docenti", "/docenti/iscritti", "/docenti/password"]) {
      await page.goto(`${APP}${path}`);
      check("7 · Accessi non autorizzati", `studente su ${path} → rimandato alla propria area`, new URL(page.url()).pathname === "/studente", page.url());
    }

    // ------------------------------------------------------------------
    // 5. Logout
    // ------------------------------------------------------------------
    const cookiesBeforeLogout = await ctx.cookies();
    await page.goto(`${APP}/studente`);
    await page.getByRole("button", { name: "Esci" }).first().click();
    await page.waitForURL(`${APP}/`, { timeout: 15000 });
    check("5 · Logout", "dopo l'uscita i cookie di sessione sono cancellati", (await ctx.cookies()).filter((c) => /-auth-token(\.\d+)?$/.test(c.name)).length === 0);
    await page.goto(`${APP}/studente`);
    check("5 · Logout", "dopo l'uscita l'area personale non è accessibile", new URL(page.url()).pathname === "/accesso");
    const replay = await newContext();
    await replay.addCookies(cookiesBeforeLogout.filter((c) => /-auth-token(\.\d+)?$/.test(c.name)));
    const replayPage = await replay.newPage();
    await replayPage.goto(`${APP}/studente`);
    check("5 · Logout", "i vecchi cookie copiati non riaprono la sessione", new URL(replayPage.url()).pathname === "/accesso", replayPage.url());
    await replay.close();

    // ------------------------------------------------------------------
    // 4. Accesso successivo
    // ------------------------------------------------------------------
    await googleLogin(page, student);
    check("4 · Accesso successivo", "lo studente registrato entra direttamente nell'area personale", new URL(page.url()).pathname === "/studente", page.url());
    check("4 · Accesso successivo", "nessuna nuova registrazione richiesta", await page.getByRole("heading", { name: "Benvenuto, Giulia Verdi" }).waitFor({ timeout: 10000 }).then(() => true, () => false));
    check("4 · Accesso successivo", "nessun profilo duplicato", (await stack.db.query("select count(*)::int n from public.students where email = $1", [student.email])).rows[0].n === 1);
    await ctx.close();

    // ------------------------------------------------------------------
    // 2. Rifiuto di account personali e non autorizzati
    // ------------------------------------------------------------------
    const rejected = [
      ["Gmail personale", { email: "giulia.verdi@gmail.com", email_verified: true, name: "Giulia Verdi" }],
      ["Gmail con dominio scolastico falsificato nel claim hd", { email: "falso@gmail.com", email_verified: true, name: "Falso", hd: "stud.liceovoltacomo.edu.it" }],
      ["account Google di un altro dominio", { email: "mario@altroliceo.edu.it", email_verified: true, name: "Mario", hd: "altroliceo.edu.it" }],
      ["account del dominio docenti non registrato", { email: "sconosciuto@liceovoltacomo.edu.it", email_verified: true, name: "Sconosciuto", hd: "liceovoltacomo.edu.it" }],
      ["account scolastico con email non verificata", { email: "non.verificato@stud.liceovoltacomo.edu.it", email_verified: false, name: "Non Verificato" }],
    ];
    for (const [label, account] of rejected) {
      ctx = await newContext();
      page = await ctx.newPage();
      await googleLogin(page, account);
      const u = new URL(page.url());
      const msgShown = (await page.getByText("Accesso non riuscito").count()) > 0;
      check("2 · Rifiuto account", `${label}: rifiutato con messaggio`, u.pathname === "/accesso" && u.searchParams.get("errore") === "account_non_autorizzato" && msgShown, page.url());
      check("2 · Rifiuto account", `${label}: nessun account creato`, !(await userExists(account.email)));
      check("2 · Rifiuto account", `${label}: nessuna sessione aperta`, (await ctx.cookies()).filter((c) => /-auth-token(\.\d+)?$/.test(c.name)).length === 0);
      if (label === "Gmail personale") {
        await page.waitForTimeout(800); await page.screenshot({ path: join(SHOTS, "rifiuto-gmail.png") });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(800); await page.screenshot({ path: join(SHOTS, "rifiuto-gmail-mobile.png"), fullPage: true });
      }
      await ctx.close();
    }

    // ------------------------------------------------------------------
    // 6. Accesso docenti
    // ------------------------------------------------------------------
    ctx = await newContext();
    page = await ctx.newPage();
    const teacherLogin = async (email, password) => {
      await page.goto(`${APP}/accesso/docenti`);
      await page.fill("#teacher-email", email);
      await page.fill("#teacher-password", password);
      await page.getByRole("button", { name: "Accedi all'area docenti" }).click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(300);
    };
    await teacherLogin("anna.rossi@liceovoltacomo.edu.it", "PasswordSbagliata1");
    check("6 · Docenti", "password errata: messaggio generico", (await page.getByText("Email o password non corretti.").count()) === 1);
    await teacherLogin("nessuno@liceovoltacomo.edu.it", stack.env.TEACHER_INITIAL_PASSWORD);
    check("6 · Docenti", "email inesistente: stesso messaggio (nessuna informazione sugli account)", (await page.getByText("Email o password non corretti.").count()) === 1);
    await teacherLogin("anna.rossi@liceovoltacomo.edu.it", stack.env.TEACHER_INITIAL_PASSWORD);
    check("6 · Docenti", "password iniziale: accesso e cambio password obbligatorio", new URL(page.url()).pathname === "/docenti/password", page.url());
    await page.waitForTimeout(800); await page.screenshot({ path: join(SHOTS, "cambio-password.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(800); await page.screenshot({ path: join(SHOTS, "cambio-password-mobile.png"), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 860 });
    await page.goto(`${APP}/docenti`);
    check("6 · Docenti", "finché non cambia password la dashboard resta bloccata", new URL(page.url()).pathname === "/docenti/password");
    const changePw = async (current, next, confirm = next) => {
      await page.fill("#pw-current", current);
      await page.fill("#pw-next", next);
      await page.fill("#pw-confirm", confirm);
      await page.getByRole("button", { name: "Salva la nuova password" }).click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(300);
    };
    await changePw(stack.env.TEACHER_INITIAL_PASSWORD, "corta1");
    check("6 · Docenti", "nuova password troppo corta rifiutata", (await page.getByText(/almeno 10 caratteri/).count()) > 0);
    await changePw(stack.env.TEACHER_INITIAL_PASSWORD, stack.env.TEACHER_INITIAL_PASSWORD.toLowerCase());
    check("6 · Docenti", "non si può riusare la password iniziale", (await page.getByText(/diversa dalla password iniziale/).count()) > 0);
    await changePw("NonQuella12", "AulaStudio2026");
    check("6 · Docenti", "password attuale sbagliata rifiutata", (await page.getByText("La password attuale non è corretta.").count()) > 0);
    await changePw(stack.env.TEACHER_INITIAL_PASSWORD, "AulaStudio2026");
    check("6 · Docenti", "cambio password riuscito", await page.getByText("Password aggiornata").waitFor({ timeout: 10000 }).then(() => true, () => false));
    await page.goto(`${APP}/docenti`);
    check("6 · Docenti", "dashboard docenti accessibile dopo il cambio", new URL(page.url()).pathname === "/docenti" && (await page.getByText("INVIA COMUNICAZIONE AGLI ISCRITTI").waitFor({ timeout: 10000 }).then(() => true, () => false)), page.url());
    await page.waitForTimeout(800); await page.screenshot({ path: join(SHOTS, "dashboard-docente.png") });
    for (const path of ["/studente", "/registrazione"]) {
      await page.goto(`${APP}${path}`);
      check("7 · Accessi non autorizzati", `docente su ${path} → rimandato alla propria area`, new URL(page.url()).pathname === "/docenti", page.url());
    }
    const teacherToken = await accessTokenOf(ctx);
    check("8 · Dati personali", "il docente non può azzerare da solo l'obbligo di cambio password", (await rest(teacherToken, "rpc/mark_teacher_password_changed", { method: "POST", body: JSON.stringify({ p_teacher_id: "00000000-0000-0000-0000-000000000000" }) })).status >= 400);
    await page.getByRole("button", { name: "Esci" }).first().click();
    await page.waitForURL(`${APP}/`, { timeout: 15000 });
    check("6 · Docenti", "logout docente", (await ctx.cookies()).filter((c) => /-auth-token(\.\d+)?$/.test(c.name)).length === 0);
    await teacherLogin("anna.rossi@liceovoltacomo.edu.it", stack.env.TEACHER_INITIAL_PASSWORD);
    check("6 · Docenti", "la vecchia password non funziona più", (await page.getByText("Email o password non corretti.").count()) === 1);
    await teacherLogin("anna.rossi@liceovoltacomo.edu.it", "AulaStudio2026");
    check("6 · Docenti", "la nuova password funziona e porta alla dashboard", new URL(page.url()).pathname === "/docenti", page.url());
    await ctx.close();

    // protezione dagli accessi ripetuti
    ctx = await newContext();
    page = await ctx.newPage();
    for (let i = 0; i < 5; i++) await teacherLogin("maria.bianchi@liceovoltacomo.edu.it", `Tentativo${i}xx`);
    await teacherLogin("maria.bianchi@liceovoltacomo.edu.it", stack.env.TEACHER_INITIAL_PASSWORD);
    check("6 · Docenti", "dopo 5 errori l'accesso è bloccato anche con la password giusta", (await page.getByText(/Troppi tentativi/).count()) === 1 && new URL(page.url()).pathname === "/accesso/docenti");
    await page.waitForTimeout(800); await page.screenshot({ path: join(SHOTS, "blocco-tentativi.png") });
    await ctx.close();

    // un docente non può usare Google
    ctx = await newContext();
    page = await ctx.newPage();
    await googleLogin(page, { email: "maria.bianchi@liceovoltacomo.edu.it", email_verified: true, name: "Maria Bianchi", hd: "liceovoltacomo.edu.it" });
    const tu = new URL(page.url());
    check("6 · Docenti", "un docente che prova ad accedere con Google viene respinto", tu.pathname === "/accesso" && ["docente_usa_password", "account_non_autorizzato"].includes(tu.searchParams.get("errore") ?? ""), page.url());
    check("6 · Docenti", "…e non resta collegato", (await ctx.cookies()).filter((c) => /-auth-token(\.\d+)?$/.test(c.name)).length === 0);
    await ctx.close();

    // ------------------------------------------------------------------
    // 7. Accessi non autorizzati senza sessione
    // ------------------------------------------------------------------
    ctx = await newContext();
    page = await ctx.newPage();
    for (const [path, target] of [["/studente", "/accesso"], ["/studente/prenotazioni", "/accesso"], ["/registrazione", "/accesso"], ["/docenti", "/accesso/docenti"], ["/docenti/statistiche", "/accesso/docenti"], ["/docenti/password", "/accesso/docenti"]]) {
      await page.goto(`${APP}${path}`);
      check("7 · Accessi non autorizzati", `senza accesso ${path} → ${target}`, new URL(page.url()).pathname === target, page.url());
    }
    const anonMe = await page.request.get(`${APP}/api/me`);
    check("7 · Accessi non autorizzati", "/api/me senza accesso → 401", anonMe.status() === 401);
    const forged = await newContext();
    await forged.addCookies([{ name: "sb-127-auth-token", value: "base64-" + Buffer.from(JSON.stringify({ access_token: stack.sign({ sub: "00000000-0000-0000-0000-000000000001", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600, amr: [{ method: "oauth", timestamp: 1 }] }).replace(/.$/, "x"), refresh_token: "x", token_type: "bearer", expires_at: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url"), url: APP }]);
    const fp = await forged.newPage();
    await fp.goto(`${APP}/studente`);
    check("7 · Accessi non autorizzati", "un token con firma falsa viene rifiutato", new URL(fp.url()).pathname === "/accesso", fp.url());
    await forged.close();
    await ctx.close();
  } finally {
    await browser?.close().catch(() => {});
    if (server?.pid) {
      try {
        process.kill(-server.pid, "SIGTERM"); // termina anche il processo next-server figlio
      } catch {}
    }
    await stack.stop();
    await google.stop();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} verifiche superate`);
  process.exit(failed.length ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
