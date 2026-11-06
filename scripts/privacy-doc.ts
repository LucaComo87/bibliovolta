/** Genera docs/INFORMATIVA_PRIVACY.md dallo stesso testo della pagina /privacy. */
import { writeFileSync } from "node:fs";
import { INFORMATIVA, type PrivacyBlock } from "../src/lib/privacy/informativa";

const out: string[] = [`# ${INFORMATIVA.title}`, "", `_${INFORMATIVA.subtitle}_`, ""];
if (INFORMATIVA.status === "bozza") {
  out.push("> **BOZZA da sottoporre al Dirigente Scolastico e al Responsabile della protezione dei dati prima della pubblicazione.** Le parti tra parentesi quadre sono da completare. Il testo si modifica in `src/lib/privacy/informativa.ts` (pagina `/privacy`); poi `npm run privacy:doc` aggiorna questo file.", "");
}
for (const s of INFORMATIVA.sections) {
  out.push(`## ${s.title}`, "");
  for (const b of s.blocks as PrivacyBlock[]) {
    if ("p" in b) out.push(b.p, "");
    else if ("list" in b) out.push(...b.list.map((l) => `- ${l}`), "");
    else out.push(`| ${b.table.head.join(" | ")} |`, `|${b.table.head.map(() => "---").join("|")}|`, ...b.table.rows.map((r) => `| ${r.join(" | ")} |`), "");
  }
}
out.push("---", "", `Versione ${INFORMATIVA.version}${INFORMATIVA.approvedOn ? ` · approvata il ${INFORMATIVA.approvedOn}` : ""}`, "");
writeFileSync("docs/INFORMATIVA_PRIVACY.md", out.join("\n"));
console.log("docs/INFORMATIVA_PRIVACY.md aggiornato");
