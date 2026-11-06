/**
 * BIBLIOVOLTA · Stack Supabase locale per i test di autenticazione
 *
 * Avvia, con i programmi ufficiali, gli stessi servizi usati da Supabase:
 *   - PostgreSQL 17 (pacchetto npm embedded-postgres)
 *   - Supabase Auth / GoTrue  (binario ufficiale da github.com/supabase/auth)
 *   - PostgREST               (binario ufficiale da github.com/PostgREST/postgrest)
 *   - un piccolo gateway su http://127.0.0.1:54321 (/auth/v1 e /rest/v1)
 * Applica le migrazioni di supabase/migrations come su Supabase.
 * Non serve Docker. Uso: node scripts/local-stack/stack.mjs  (Ctrl+C per fermare)
 *
 * Google OAuth: GoTrue viene configurato con il provider Google attivo e
 * credenziali fittizie, così si verifica davvero il reindirizzamento verso
 * accounts.google.com con i parametri giusti. Completare il login con
 * Google richiede invece credenziali reali (vedi README).
 */
import { spawn } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import http from "node:http";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

const ROOT = process.cwd();
const DIR = join(ROOT, ".local-stack");
const BIN = join(DIR, "bin");
const GOTRUE_VERSION = "v2.180.0";
const POSTGREST_VERSION = "v12.2.3";
const PORTS = { pg: 54322, gotrue: 54399, rest: 54398, gateway: 54321 };
const SITE_URL = process.env.STACK_SITE_URL ?? "http://localhost:3400";
export const GOOGLE_TEST_CLIENT = { id: "test-client-id.apps.googleusercontent.com", secret: "test-secret" };
const JWT_SECRET = "bibliovolta-local-test-secret-not-for-production-0123456789";
const PW = "postgres";

function sign(payload) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64(payload);
  const sig = createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
const now = Math.floor(Date.now() / 1000);
export const ANON_KEY = sign({ iss: "supabase", role: "anon", iat: now, exp: now + 10 * 365 * 86400 });
export const SERVICE_KEY = sign({ iss: "supabase", role: "service_role", iat: now, exp: now + 10 * 365 * 86400 });

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download non riuscito: ${url} (${res.status})`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function ensureBinaries() {
  mkdirSync(BIN, { recursive: true });
  const run = (cmd, args, cwd) =>
    new Promise((ok, ko) => spawn(cmd, args, { cwd, stdio: "inherit" }).on("exit", (c) => (c === 0 ? ok() : ko(new Error(`${cmd} ${c}`)))));
  if (!existsSync(join(BIN, "gotrue"))) {
    console.log("Scarico Supabase Auth", GOTRUE_VERSION);
    const tgz = join(DIR, "auth.tgz");
    await download(`https://github.com/supabase/auth/releases/download/${GOTRUE_VERSION}/auth-${GOTRUE_VERSION}-x86.tar.gz`, tgz);
    const tmp = join(DIR, "auth-tmp");
    mkdirSync(tmp, { recursive: true });
    await run("tar", ["xzf", tgz, "-C", tmp]);
    await run("mv", [join(tmp, "auth"), join(BIN, "gotrue")]);
    await run("rm", ["-rf", join(DIR, "gotrue-migrations")]);
    await run("mv", [join(tmp, "migrations"), join(DIR, "gotrue-migrations")]);
    await run("rm", ["-rf", tmp, tgz]);
  }
  if (!existsSync(join(BIN, "postgrest"))) {
    console.log("Scarico PostgREST", POSTGREST_VERSION);
    const xz = join(DIR, "pgrst.tar.xz");
    await download(`https://github.com/PostgREST/postgrest/releases/download/${POSTGREST_VERSION}/postgrest-${POSTGREST_VERSION}-linux-static-x64.tar.xz`, xz);
    await run("tar", ["xJf", xz, "-C", BIN]);
    await run("rm", ["-f", xz]);
  }
}

/** Ruoli e privilegi predefiniti come in un progetto Supabase. */
const BOOTSTRAP = `
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login noinherit password '${PW}'; end if;
    if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin login createrole noinherit password '${PW}'; end if;
  end $$;
  grant anon, authenticated, service_role to authenticator;
  create schema if not exists auth authorization supabase_auth_admin;
  grant usage on schema auth to anon, authenticated, service_role;
  alter role supabase_auth_admin set search_path = auth;
  grant usage on schema public to anon, authenticated, service_role;
  grant all on schema public to postgres;
  -- come su Supabase: privilegi predefiniti larghi, ristretti poi dalla RLS e dalle REVOKE delle migrazioni
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  create table if not exists public._local_migrations (name text primary key, applied_at timestamptz default now());
  revoke all on public._local_migrations from anon, authenticated;
`;

function startProcess(name, cmd, args, env) {
  const p = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  const log = (d) => process.env.STACK_VERBOSE && process.stdout.write(`[${name}] ${d}`);
  p.stdout.on("data", log);
  p.stderr.on("data", (d) => {
    log(d);
    if (/fatal|panic/i.test(String(d))) process.stderr.write(`[${name}] ${d}`);
  });
  return p;
}

async function waitFor(url, label, tries = 80) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${label} non risponde (${url})`);
}

function startGateway() {
  const route = (path) =>
    path.startsWith("/auth/v1/") ? { port: PORTS.gotrue, path: path.slice("/auth/v1".length) }
    : path.startsWith("/rest/v1/") ? { port: PORTS.rest, path: path.slice("/rest/v1".length) }
    : null;
  return http
    .createServer((req, res) => {
      const target = route(req.url ?? "/");
      if (!target) {
        res.writeHead(404).end();
        return;
      }
      const headers = { ...req.headers, host: `127.0.0.1:${target.port}` };
      // come Kong su Supabase: senza Authorization si usa la apikey
      if (!headers.authorization && headers.apikey) headers.authorization = `Bearer ${headers.apikey}`;
      const up = http.request({ host: "127.0.0.1", port: target.port, path: target.path, method: req.method, headers }, (r) => {
        res.writeHead(r.statusCode ?? 502, r.headers);
        r.pipe(res);
      });
      up.on("error", () => res.writeHead(502).end());
      req.pipe(up);
    })
    .listen(PORTS.gateway, "127.0.0.1");
}

export async function startStack({ fresh = true, googleCaBundle } = {}) {
  await ensureBinaries();
  const dataDir = join(DIR, "pgdata");
  if (fresh) {
    await new Promise((ok) => spawn("rm", ["-rf", dataDir]).on("exit", ok));
  }
  // PostgreSQL non può girare come root: in quel caso si usa l'utente di sistema "postgres"
  const isRoot = process.getuid?.() === 0;
  if (isRoot && !existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
    await new Promise((ok) => spawn("chown", ["postgres:postgres", dataDir]).on("exit", ok));
  }
  const pgServer = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "postgres",
    password: PW,
    port: PORTS.pg,
    persistent: !fresh,
    createPostgresUser: isRoot,
    onLog: () => {},
    onError: () => {},
  });
  if (!existsSync(join(dataDir, "PG_VERSION"))) await pgServer.initialise();
  await pgServer.start();

  const db = new pg.Client({ host: "127.0.0.1", port: PORTS.pg, user: "postgres", password: PW, database: "postgres" });
  await db.connect();
  await db.query(BOOTSTRAP);

  const gotrue = startProcess("auth", join(BIN, "gotrue"), [], {
    GOTRUE_API_HOST: "127.0.0.1",
    PORT: String(PORTS.gotrue),
    API_EXTERNAL_URL: `http://127.0.0.1:${PORTS.gateway}/auth/v1`,
    GOTRUE_DB_DRIVER: "postgres",
    DATABASE_URL: `postgres://supabase_auth_admin:${PW}@127.0.0.1:${PORTS.pg}/postgres?sslmode=disable`,
    GOTRUE_DB_NAMESPACE: "auth",
    GOTRUE_DB_MIGRATIONS_PATH: join(DIR, "gotrue-migrations"),
    GOTRUE_SITE_URL: SITE_URL,
    GOTRUE_URI_ALLOW_LIST: `${SITE_URL}/**`,
    GOTRUE_JWT_SECRET: JWT_SECRET,
    GOTRUE_JWT_EXP: "3600",
    GOTRUE_JWT_AUD: "authenticated",
    GOTRUE_JWT_DEFAULT_GROUP_NAME: "authenticated", // come su Supabase: ruolo "authenticated" nei JWT
    GOTRUE_JWT_ADMIN_ROLES: "service_role",
    GOTRUE_DISABLE_SIGNUP: "false",
    GOTRUE_EXTERNAL_EMAIL_ENABLED: "true",
    GOTRUE_MAILER_AUTOCONFIRM: "true",
    GOTRUE_EXTERNAL_GOOGLE_ENABLED: "true",
    GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID: GOOGLE_TEST_CLIENT.id,
    GOTRUE_EXTERNAL_GOOGLE_SECRET: GOOGLE_TEST_CLIENT.secret,
    GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI: `http://127.0.0.1:${PORTS.gateway}/auth/v1/callback`,
    GOTRUE_PASSWORD_MIN_LENGTH: "10",
    GOTRUE_RATE_LIMIT_HEADER: "X-Forwarded-For",
    GOTRUE_LOG_LEVEL: "warn",
    // con il provider di prova: Google raggiunto in locale, senza proxy, con la CA di prova
    ...(googleCaBundle
      ? { SSL_CERT_FILE: googleCaBundle, HTTPS_PROXY: "", https_proxy: "", HTTP_PROXY: "", http_proxy: "", NO_PROXY: "*", no_proxy: "*" }
      : {}),
  });
  await waitFor(`http://127.0.0.1:${PORTS.gotrue}/health`, "Supabase Auth");

  // migrazioni del progetto
  const migDir = join(ROOT, "supabase", "migrations");
  for (const file of readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort()) {
    const done = await db.query("select 1 from public._local_migrations where name = $1", [file]);
    if (done.rowCount) continue;
    await db.query(readFileSync(join(migDir, file), "utf8"));
    await db.query("insert into public._local_migrations (name) values ($1)", [file]);
  }

  const rest = startProcess("rest", join(BIN, "postgrest"), [], {
    PGRST_DB_URI: `postgres://authenticator:${PW}@127.0.0.1:${PORTS.pg}/postgres`,
    PGRST_DB_SCHEMAS: "public",
    PGRST_DB_ANON_ROLE: "anon",
    PGRST_JWT_SECRET: JWT_SECRET,
    PGRST_SERVER_PORT: String(PORTS.rest),
    PGRST_SERVER_HOST: "127.0.0.1",
    PGRST_DB_POOL: "20",
  });
  await waitFor(`http://127.0.0.1:${PORTS.rest}/`, "PostgREST");
  const gateway = startGateway();

  const env = {
    NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${PORTS.gateway}`,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    NEXT_PUBLIC_SITE_URL: SITE_URL,
    // password di prova, diversa da quella reale (che sta solo nelle variabili d'ambiente)
    TEACHER_INITIAL_PASSWORD: process.env.TEST_TEACHER_PASSWORD || "Prova-Iniziale-2026",
  };
  writeFileSync(join(DIR, "env.json"), JSON.stringify(env, null, 2));

  async function stop() {
    gateway.close();
    rest.kill();
    gotrue.kill();
    await db.end().catch(() => {});
    await pgServer.stop().catch(() => {});
  }
  return { env, db, jwtSecret: JWT_SECRET, sign, ports: PORTS, stop };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const stack = await startStack({ fresh: !process.argv.includes("--keep") });
  console.log("Stack Supabase locale pronto:");
  console.log(JSON.stringify(stack.env, null, 2));
  const shutdown = async () => {
    await stack.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  setInterval(() => {}, 1 << 30);
}

export { randomBytes };
