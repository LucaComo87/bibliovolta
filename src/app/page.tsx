import {
  ArrowRight,
  BellRing,
  CalendarCheck2,
  CalendarDays,
  Clock3,
  GraduationCap,
  ListOrdered,
  LogIn,
  MailCheck,
  Undo2,
  Users,
} from "lucide-react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { LibraryBackdrop } from "@/components/media/LibraryPhoto";
import { ButtonLink } from "@/components/ui/Button";
import { CALENDAR, ROUTES } from "@/lib/config";
import { formatDayMedium } from "@/lib/dates";

const quickFacts = [
  { icon: <Clock3 />, label: "Orario", value: `${CALENDAR.opensAt} – ${CALENDAR.closesAt}`, hint: "dal lunedì al venerdì" },
  { icon: <Users />, label: "Posti", value: `${CALENDAR.capacity}`, hint: "ogni pomeriggio" },
  { icon: <CalendarDays />, label: "Apertura", value: "16 novembre", hint: "fino al 4 giugno 2027" },
  { icon: <Undo2 />, label: "Annullamento", value: `${CALENDAR.cancellationHours} ore`, hint: "di preavviso" },
];

const steps = [
  {
    icon: <LogIn />,
    title: "Accedi con Google",
    text: "Usa il tuo account Google della scuola: nessuna nuova password da ricordare.",
  },
  {
    icon: <CalendarCheck2 />,
    title: "Scegli la giornata",
    text: "Il calendario mostra in tempo reale i posti liberi di ogni pomeriggio. Un tocco e il posto è tuo.",
  },
  {
    icon: <MailCheck />,
    title: "Ricevi la conferma",
    text: "Ti arriva un'email di conferma. Se cambi programma, annulli dall'area personale.",
  },
];

const rules = [
  { icon: <GraduationCap />, title: "Chi può prenotare", text: "Tutti gli studenti del Liceo Volta, con l'account Google istituzionale." },
  { icon: <Clock3 />, title: "Quando", text: `Dal lunedì al venerdì, dalle ${CALENDAR.opensAt} alle ${CALENDAR.closesAt}, da ${formatDayMedium(CALENDAR.seasonStart)} a ${formatDayMedium(CALENDAR.seasonEnd)}.` },
  { icon: <Users />, title: "Quanti posti", text: `${CALENDAR.capacity} posti al giorno. Ogni studente può avere una prenotazione per giornata.` },
  { icon: <Undo2 />, title: "Annullare", text: `Fino a ${CALENDAR.cancellationHours} ore prima dell'apertura, per lasciare il posto a chi è in attesa.` },
  { icon: <ListOrdered />, title: "Lista d'attesa", text: "Se la giornata è completa, mettiti in coda: se un posto si libera ti viene proposto." },
  { icon: <BellRing />, title: "Comunicazioni", text: "Chiusure, cambi d'orario e avvisi dei docenti arrivano nell'area personale e per email." },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader variant="overlay" />
      <main className="flex-1">
        {/* ---------- Copertina con la fotografia della biblioteca ---------- */}
        <LibraryBackdrop overlay="hero" priority position="50% 16%" className="min-h-[680px]">
          <div className="mx-auto flex min-h-[680px] max-w-6xl flex-col justify-end px-4 pb-28 pt-32 sm:justify-center sm:px-6 sm:pb-36">
            <div className="max-w-xl animate-rise text-white">
              <p className="mb-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-gold">
                <span className="gold-rule" /> BIBLIOVOLTA
              </p>
              <h1 className="font-display text-[2.6rem] font-semibold leading-[1.05] text-balance sm:text-6xl">
                La tua aula studio, il tuo spazio.
              </h1>
              <p className="mt-5 max-w-md text-lg text-white/85 sm:text-xl">
                Prenota il tuo posto nella biblioteca del Liceo Volta.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href={ROUTES.login} variant="gold" size="lg" className="uppercase">
                  Prenota il tuo posto <ArrowRight />
                </ButtonLink>
                <ButtonLink href={ROUTES.teacherLogin} variant="outline-light" size="lg" className="uppercase">
                  Area docenti
                </ButtonLink>
              </div>
            </div>
          </div>
        </LibraryBackdrop>

        {/* ---------- Informazioni rapide ---------- */}
        <section aria-label="Informazioni rapide" className="relative z-10 mx-auto -mt-16 max-w-6xl px-4 sm:-mt-20 sm:px-6">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-lift lg:grid-cols-4">
            {quickFacts.map((f, i) => (
              <div key={f.label} className="animate-rise bg-surface p-4 sm:p-6" style={{ animationDelay: `${120 + i * 70}ms` }}>
                <dt className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted [&_svg]:size-4 [&_svg]:text-gold">
                  {f.icon}
                  {f.label}
                </dt>
                <dd className="mt-2 font-display text-xl font-semibold text-ink sm:text-2xl">{f.value}</dd>
                <dd className="text-xs text-muted sm:text-sm">{f.hint}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ---------- Presentazione ---------- */}
        <section id="come-funziona" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid gap-10">
            <div className="max-w-2xl">
              <p className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-wood">
                <span className="gold-rule" /> Il servizio
              </p>
              <h2 className="font-display text-3xl font-semibold leading-tight text-ink text-balance sm:text-4xl">
                Un posto tra gli scaffali storici, ogni pomeriggio.
              </h2>
              <p className="mt-4 text-muted">
                L&apos;aula studio è ospitata nella biblioteca storica del Volta, sotto la volta con lo stemma e i ballatoi
                in legno. BIBLIOVOLTA ti permette di sapere prima se c&apos;è posto e di riservarlo in pochi secondi, anche
                dal telefono.
              </p>
            </div>
            <ol className="grid gap-4 sm:grid-cols-3">
              {steps.map((s, i) => (
                <li key={s.title} className="rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-lift">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="grid size-10 place-items-center rounded-lg bg-ink text-gold [&_svg]:size-5">{s.icon}</span>
                    <span className="font-display text-3xl font-semibold text-line">{i + 1}</span>
                  </div>
                  <h3 className="font-display text-lg font-semibold text-ink">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-muted">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- Informazioni essenziali ---------- */}
        <section id="informazioni" className="scroll-mt-20 border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="mb-10 max-w-2xl">
              <p className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-wood">
                <span className="gold-rule" /> Prenotazioni
              </p>
              <h2 className="font-display text-3xl font-semibold text-ink text-balance">Le regole in breve</h2>
            </div>
            <ul className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {rules.map((r) => (
                <li key={r.title} className="flex gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gold-soft text-wood [&_svg]:size-5">{r.icon}</span>
                  <div>
                    <h3 className="font-semibold text-ink">{r.title}</h3>
                    <p className="mt-1 text-sm text-muted">{r.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- Chiusura con fotografia ---------- */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <LibraryBackdrop overlay="banner" source="panorama" position="50% 40%" sizes="(min-width: 1152px) 1104px, 100vw" className="rounded-2xl shadow-lift">
            <div className="flex flex-col items-start gap-6 px-6 py-12 text-white sm:flex-row sm:items-center sm:justify-between sm:px-12 sm:py-16">
              <div className="max-w-lg">
                <h2 className="font-display text-3xl font-semibold text-balance">Pronto a studiare?</h2>
                <p className="mt-2 text-white/80">Controlla i posti liberi di questa settimana e prenota il tuo pomeriggio in biblioteca.</p>
              </div>
              <ButtonLink href={ROUTES.login} variant="gold" size="lg" className="uppercase">
                Prenota il tuo posto <ArrowRight />
              </ButtonLink>
            </div>
          </LibraryBackdrop>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
