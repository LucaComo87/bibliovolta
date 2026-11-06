import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/PageContainer";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Notice } from "@/components/ui/Notice";
import { PageHeading } from "@/components/ui/PageHeading";
import { INFORMATIVA, type PrivacyBlock } from "@/lib/privacy/informativa";

export const metadata: Metadata = { title: "Informativa privacy" };

/** Informativa sul trattamento dei dati (testo in lib/privacy/informativa.ts). */
export default function PrivacyPage() {
  return (
    <PublicLayout>
      <PageContainer>
        <PageHeading eyebrow="Privacy" title={INFORMATIVA.title}>
          {INFORMATIVA.subtitle}
        </PageHeading>
        {INFORMATIVA.status === "bozza" && (
          <Notice tone="warning" title="Bozza in attesa di approvazione" className="mb-6 max-w-3xl">
            Testo da approvare dal Dirigente Scolastico e dal Responsabile della protezione dei dati. Le parti tra parentesi quadre sono da completare.
          </Notice>
        )}
        <article className="max-w-3xl space-y-8 text-[15px] leading-relaxed text-ink" data-testid="privacy-text">
          {INFORMATIVA.sections.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`h-${s.id}`} className="space-y-3">
              <h2 id={`h-${s.id}`} className="font-display text-xl font-semibold text-ink">{s.title}</h2>
              {(s.blocks as PrivacyBlock[]).map((b, i) => <Block key={i} b={b} />)}
            </section>
          ))}
          <p className="border-t border-line pt-4 text-xs text-muted">
            Versione {INFORMATIVA.version}
            {INFORMATIVA.approvedOn ? ` · approvata il ${INFORMATIVA.approvedOn}` : ""}
          </p>
        </article>
      </PageContainer>
    </PublicLayout>
  );
}

function Block({ b }: { b: PrivacyBlock }) {
  if ("p" in b) return <p className="text-ink/85">{b.p}</p>;
  if ("list" in b)
    return (
      <ul className="list-disc space-y-1.5 pl-5 text-ink/85 marker:text-gold">
        {b.list.map((li) => <li key={li}>{li}</li>)}
      </ul>
    );
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-left text-sm">
        <thead className="bg-paper text-[11px] uppercase tracking-[0.08em] text-muted">
          <tr>{b.table.head.map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">
          {b.table.rows.map((r) => (
            <tr key={r[0]}>{r.map((c, i) => <td key={i} className={`px-4 py-2.5 align-top ${i === 0 ? "font-medium text-ink" : "text-ink/80"}`}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
