/**
 * BIBLIOVOLTA · Collaudo completo prima della pubblicazione (Fase 7)
 *
 *   npm run test:all        (Linux, root)
 *
 * Esegue in sequenza: controllo dei tipi, lint, test del database, build
 * di produzione e tutte le prove end-to-end (autenticazione, prenotazioni,
 * lista d'attesa, docenti, sicurezza, grafica). Scrive l'esito di ogni
 * singola verifica in docs/TEST_REPORT.md e .local-stack/test-report.json.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SUITES = [
  { id: "typecheck", title: "Controllo dei tipi TypeScript", cmd: ["npm", ["run", "typecheck"]] },
  { id: "lint", title: "Lint (ESLint)", cmd: ["npm", ["run", "lint"]] },
  { id: "db", title: "Database: migrazioni, regole, permessi, privacy", cmd: ["npm", ["run", "db:test"]] },
  { id: "build", title: "Build di produzione", cmd: ["npm", ["run", "build"]] },
  { id: "auth", title: "Autenticazione e registrazione", cmd: ["node", ["scripts/test-auth.mjs"]] },
  { id: "bookings", title: "Calendario e prenotazioni", cmd: ["node", ["scripts/test-bookings.mjs", "--no-build"]] },
  { id: "waitlist", title: "Lista d'attesa automatica", cmd: ["node", ["scripts/test-waitlist.mjs", "--no-build"]] },
  { id: "teacher", title: "Dashboard docenti e comunicazioni", cmd: ["node", ["scripts/test-teacher.mjs", "--no-build"]] },
  { id: "security", title: "Sicurezza e privacy", cmd: ["node", ["scripts/test-security.mjs", "--no-build"]] },
  { id: "ui", title: "Grafica su smartphone, tablet e computer", cmd: ["node", ["scripts/test-ui.mjs", "--no-build"]] },
];
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));

function run([cmd, args]) {
  return new Promise((resolve) => {
    const started = Date.now();
    let out = "";
    const p = spawn(cmd, args, { cwd: ROOT, env: process.env });
    p.stdout.on("data", (d) => ((out += d), process.stdout.write(d)));
    p.stderr.on("data", (d) => (out += d));
    p.on("exit", (code) => resolve({ code, out, seconds: Math.round((Date.now() - started) / 1000) }));
  });
}

const report = [];
for (const s of SUITES) {
  if (only.length && !only.includes(s.id)) continue;
  console.log(`\n=== ${s.title} ===`);
  const r = await run(s.cmd);
  const checks = [...r.out.matchAll(/^(✔|✘) (?:\[([^\]]+)\] )?(.+?)(?:  →  (.*))?$/gm)].map((m) => ({ ok: m[1] === "✔", group: m[2] ?? "", name: m[3], detail: m[4] ?? "" }));
  report.push({ ...s, cmd: undefined, ok: r.code === 0, seconds: r.seconds, passed: checks.filter((c) => c.ok).length, total: checks.length, checks });
}

const when = new Intl.DateTimeFormat("it-IT", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Rome" }).format(new Date());
const lines = [
  "# BIBLIOVOLTA · Rapporto di collaudo",
  "",
  `_Eseguito il ${when} con \`npm run test:all\`. Ambiente: build di produzione Next.js, PostgreSQL 17 + Supabase Auth + PostgREST in locale, Chrome, Google e Resend sostituiti da servizi di prova._`,
  "",
  "| Prova | Esito | Verifiche | Durata |",
  "|---|---|---|---|",
  ...report.map((r) => `| ${r.title} | ${r.ok ? "✅ superata" : "❌ non superata"} | ${r.total ? `${r.passed}/${r.total}` : "—"} | ${r.seconds} s |`),
  "",
  `**Totale: ${report.reduce((a, r) => a + r.passed, 0)}/${report.reduce((a, r) => a + r.total, 0)} verifiche superate.**`,
  "",
];
for (const r of report.filter((x) => x.checks.length)) {
  lines.push(`## ${r.title}`, "");
  let group = null;
  for (const c of r.checks) {
    if (c.group !== group) {
      group = c.group;
      if (group) lines.push("", `**${group}**`, "");
    }
    lines.push(`- ${c.ok ? "✅" : "❌"} ${c.name}${!c.ok && c.detail ? ` — ${c.detail}` : ""}`);
  }
  lines.push("");
}
mkdirSync(join(ROOT, ".local-stack"), { recursive: true });
if (!only.length) writeFileSync(join(ROOT, "docs", "TEST_REPORT.md"), lines.join("\n"));
writeFileSync(join(ROOT, ".local-stack", "test-report.json"), JSON.stringify(report, null, 2));
console.log(`\n${report.map((r) => `${r.ok ? "✔" : "✘"} ${r.title}: ${r.total ? `${r.passed}/${r.total}` : r.ok ? "ok" : "errore"}`).join("\n")}`);
process.exit(report.every((r) => r.ok) ? 0 : 1);
