import Link from "next/link";
import { APP } from "@/lib/config";
import { BellRing, CalendarCheck2, CalendarDays, GraduationCap, Hourglass, Mail } from "lucide-react";
import { LibraryBackdrop } from "@/components/media/LibraryPhoto";
import { DateTile } from "@/components/student/BookingCards";
import { Badge } from "@/components/ui/Badge";
import { Card, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { CALENDAR } from "@/lib/config";
import { formatDateTime, formatDayMedium } from "@/lib/dates";

import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/Button";
export type WelcomeWait = { id: string; day: string; status: "waiting" | "offered"; position?: number | null; offerExpiresAt?: string };
export type WelcomeAnnouncement = { id: string; title: string; body: string; publishedAt: string };

/** Area personale reale: benvenuto e le tre sezioni, con i dati letti dal database. */
export function StudentWelcome({
  firstName,
  lastName,
  className,
  email,
  nextBooking,
  bookingsContent,
  calendarHref,
  waitlist,
  announcements,
  dataExportHref,
}: {
  firstName: string;
  lastName: string;
  className: string | null;
  email: string;
  /** prossimo pomeriggio prenotato, mostrato sulla copertina */
  nextBooking?: { day: string; opensAt: string; closesAt: string } | null;
  /** elenco delle prenotazioni future (componente interattivo) */
  bookingsContent: ReactNode;
  calendarHref: string;
  waitlist: WelcomeWait[];
  announcements: WelcomeAnnouncement[];
  /** download dei propri dati (assente nell'anteprima) */
  dataExportHref?: string;
}) {
  return (
    <div className="space-y-8">
      <LibraryBackdrop overlay="banner" source="panorama" position="50% 35%" sizes="(min-width: 1152px) 1104px, 100vw" className="animate-rise rounded-2xl shadow-lift">
        <div className="flex flex-col gap-5 p-6 text-white sm:p-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Area personale</p>
            <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
              Benvenuto, {firstName} {lastName}
            </h1>
            <p className="mt-1 text-white/80">
              {nextBooking
                ? <>Prossimo pomeriggio in biblioteca: <strong className="font-semibold text-white first-letter:uppercase">{formatDayMedium(nextBooking.day)}</strong>, {nextBooking.opensAt}–{nextBooking.closesAt}.</>
                : <>La biblioteca del Volta ti aspetta, dal lunedì al venerdì {CALENDAR.opensAt}–{CALENDAR.closesAt}.</>}
            </p>
            <ButtonLink href={calendarHref} variant="gold" size="md" className="mt-4">
              <CalendarDays /> Prenota un posto
            </ButtonLink>
          </div>
          <dl className="flex flex-wrap gap-2 text-sm">
            {className && (
              <div className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-md">
                <GraduationCap className="size-4 text-gold" /> <dt className="sr-only">Classe</dt><dd>Classe {className}</dd>
              </div>
            )}
            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-md">
              <Mail className="size-4 shrink-0 text-gold" /> <dt className="sr-only">Email</dt><dd className="truncate">{email}</dd>
            </div>
          </dl>
        </div>
      </LibraryBackdrop>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="animate-rise lg:col-span-2">
          <CardTitle icon={<CalendarCheck2 />} eyebrow="Prenotazioni future">Le mie prenotazioni</CardTitle>
          {bookingsContent}
        </Card>

        <Card className="animate-rise">
          <CardTitle
            icon={<Hourglass />}
            eyebrow="Liste d'attesa"
            action={<Link href={`${calendarHref.replace("/calendario", "")}/attesa`} className="text-sm font-semibold text-ink-soft hover:text-ink">Gestisci</Link>}
          >
            Le mie liste d&apos;attesa
          </CardTitle>
          {waitlist.length ? (
            <ul className="space-y-3">
              {waitlist.map((w) => (
                <li key={w.id} className={`flex items-center gap-4 rounded-xl border p-3 ${w.status === "offered" ? "border-gold bg-gold-soft/40" : "border-line"}`}>
                  <DateTile day={w.day} tone={w.status === "offered" ? "gold" : "muted"} />
                  <div className="min-w-0">
                    <p className="font-semibold first-letter:uppercase text-ink">{formatDayMedium(w.day)}</p>
                    <p className="text-xs text-muted">
                      {w.status === "offered"
                        ? `Conferma entro ${w.offerExpiresAt ? formatDateTime(w.offerExpiresAt) : "il tempo indicato"}`
                        : `Posizione ${w.position}°`}
                    </p>
                  </div>
                  <Badge tone={w.status === "offered" ? "gold" : "blue"} className="ml-auto">{w.status === "offered" ? "Posto proposto" : "In attesa"}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Hourglass />} title="Non sei in nessuna lista">
              Quando una giornata è completa puoi iscriverti dal calendario: se si libera un posto ti avvisiamo per email.
            </EmptyState>
          )}
        </Card>

        <Card className="animate-rise">
          <CardTitle icon={<BellRing />} eyebrow="Dai docenti">Comunicazioni</CardTitle>
          {announcements.length ? (
            <ul className="divide-y divide-line">
              {announcements.map((a) => (
                <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="font-semibold text-ink">{a.title}</p>
                  <p className="mt-0.5 text-sm text-muted">{a.body}</p>
                  <p className="mt-1 text-xs text-muted/80">{formatDateTime(a.publishedAt)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<BellRing />} title="Nessuna comunicazione">
              Qui troverai gli avvisi dei docenti su chiusure e cambi d&apos;orario.
            </EmptyState>
          )}
        </Card>
      </div>
      <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted">
        <span>I tuoi dati:</span>
        {dataExportHref ? (
          <a href={dataExportHref} download className="font-semibold text-ink-soft underline-offset-2 hover:underline">Scarica i miei dati</a>
        ) : (
          <span className="opacity-60">Scarica i miei dati</span>
        )}
        <a href={APP.privacyUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink-soft underline-offset-2 hover:underline">Informativa privacy</a>
      </p>
    </div>
  );
}
