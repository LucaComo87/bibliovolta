import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeading } from "@/components/ui/PageHeading";

const groups = [
  {
    title: "Pagine pubbliche",
    items: [
      { href: "/", label: "Homepage", text: "Copertina con la biblioteca, presentazione e regole" },
      { href: "/accesso", label: "Accesso studenti", text: "Login Google sulla fotografia della biblioteca" },
      { href: "/accesso/docenti", label: "Accesso docenti", text: "Email e password" },
    ],
  },
  {
    title: "Area studenti",
    items: [
      { href: "/anteprima/studente", label: "Area personale", text: "Prossima prenotazione, proposte, prenotazione rapida" },
      { href: "/anteprima/studente/calendario", label: "Calendario mensile", text: "Posti disponibili e scheda della giornata" },
      { href: "/anteprima/studente/prenotazioni", label: "Prenotazioni", text: "In programma, passate, annullate" },
      { href: "/anteprima/studente/attesa", label: "Liste d'attesa", text: "Posizione in coda e posti proposti" },
    ],
  },
  {
    title: "Area docenti",
    items: [
      { href: "/anteprima/docenti", label: "Dashboard", text: "Occupazione, lista d'attesa, ultime operazioni" },
      { href: "/anteprima/docenti/calendario", label: "Calendario gestionale", text: "Aperture, chiusure, capienza e note" },
      { href: "/anteprima/docenti/iscritti", label: "Elenco iscritti", text: "Prenotati della giornata e lista d'attesa" },
      { href: "/anteprima/docenti/comunicazioni", label: "Comunicazioni", text: "Composizione e messaggi inviati" },
      { href: "/anteprima/docenti/statistiche", label: "Statistiche", text: "Occupazione, giorni e classi" },
    ],
  },
];

export default function PreviewIndex() {
  return (
    <>
      <PageContainer>
        <PageHeading eyebrow="Fase 2" title="Schermate di BIBLIOVOLTA">
          Le aree riservate sono mostrate con dati dimostrativi. Le pagine pubbliche sono quelle reali.
        </PageHeading>
        <div className="grid gap-8 lg:grid-cols-3">
          {groups.map((g) => (
            <section key={g.title}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-wood">{g.title}</h2>
              <ul className="space-y-2">
                {g.items.map((i) => (
                  <li key={i.href}>
                    <Link href={i.href} className="group flex items-start justify-between gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
                      <span>
                        <span className="block font-semibold text-ink">{i.label}</span>
                        <span className="text-sm text-muted">{i.text}</span>
                      </span>
                      <ArrowUpRight className="size-4 shrink-0 text-muted transition group-hover:text-ink" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </PageContainer>
      <SiteFooter />
    </>
  );
}
