"use client";

import { ArrowRight, BellRing, CalendarCheck2, CalendarDays, Clock3, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LibraryBackdrop } from "@/components/media/LibraryPhoto";
import { BookConfirmSheet } from "@/components/student/BookConfirmSheet";
import { BookingCard, WaitlistCard } from "@/components/student/BookingCards";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SeatMeter } from "@/components/ui/SeatMeter";
import { availabilityLevel, type CalendarDay } from "@/lib/calendar";
import { CALENDAR } from "@/lib/config";
import { dayOfMonth, formatDateTime, formatDayMedium, formatWeekdayShort } from "@/lib/dates";

export type StudentBooking = { id: string; day: string; status: "confirmed" | "cancelled" | "attended"; createdAt: string };
export type StudentWaitlist = { id: string; day: string; position: number | null; status: "waiting" | "offered"; offerExpiresAt?: string; offerId?: string };
export type StudentAnnouncement = { id: string; title: string; body: string; publishedAt: string };

export function StudentHome({
  firstName,
  base,
  today,
  now,
  days,
  bookings,
  waitlist,
  announcements,
  onBook,
  onCancel,
  onAccept,
  onDecline,
}: {
  firstName: string;
  base: string;
  today: string;
  now: Date;
  days: CalendarDay[];
  bookings: StudentBooking[];
  waitlist: StudentWaitlist[];
  announcements: StudentAnnouncement[];
  onBook: (day: string) => void;
  onCancel: (id: string) => void;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  const [pending, setPending] = useState<CalendarDay | null>(null);
  const router = useRouter();
  const upcoming = bookings.filter((b) => b.status === "confirmed" && b.day >= today).sort((a, b) => a.day.localeCompare(b.day));
  const next = upcoming[0];
  const bookedDays = new Set(upcoming.map((b) => b.day));
  const waitDays = new Set(waitlist.map((w) => w.day));
  const quick = days
    .filter((d) => d.day >= today && d.isOpen && !bookedDays.has(d.day) && !waitDays.has(d.day))
    .slice(0, 6);
  const offers = waitlist.filter((w) => w.status === "offered");

  return (
    <div className="space-y-8">
      {/* Copertina con la biblioteca */}
      <LibraryBackdrop overlay="banner" source="panorama" position="50% 35%" sizes="(min-width: 1152px) 1104px, 100vw" className="animate-rise rounded-2xl shadow-lift">
        <div className="grid gap-6 p-6 text-white sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Area personale</p>
            <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Ciao, {firstName}</h1>
            <p className="mt-1 text-white/80">
              {upcoming.length === 0
                ? "Non hai prenotazioni in programma."
                : `Hai ${upcoming.length} ${upcoming.length === 1 ? "prenotazione" : "prenotazioni"} in programma.`}
            </p>
          </div>
          {next ? (
            <div className="rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-md sm:min-w-72">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">Prossimo pomeriggio in biblioteca</p>
              <p className="mt-1 font-display text-xl font-semibold first-letter:uppercase">{formatDayMedium(next.day)}</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-white/80">
                <Clock3 className="size-4" /> {CALENDAR.opensAt}–{CALENDAR.closesAt}
              </p>
            </div>
          ) : (
            <ButtonLink href={`${base}/calendario`} variant="gold" size="lg">
              <CalendarDays /> Scegli una giornata
            </ButtonLink>
          )}
        </div>
      </LibraryBackdrop>

      {offers.length > 0 && (
        <section aria-label="Proposte di posto" className="animate-rise space-y-3" style={{ animationDelay: "80ms" }}>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
            <Sparkles className="size-5 text-gold" /> Un posto si è liberato
          </h2>
          <ul>
            {offers.map((o) => (
              <WaitlistCard key={o.id} {...o} onAccept={() => onAccept(o.id)} onDecline={() => onDecline(o.id)} />
            ))}
          </ul>
        </section>
      )}

      {/* Prenotazione rapida: due tocchi */}
      <section aria-labelledby="quick" className="animate-rise" style={{ animationDelay: "140ms" }}>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 id="quick" className="font-display text-xl font-semibold text-ink">Prenota in un tocco</h2>
            <p className="text-sm text-muted">Le prossime giornate con posti liberi.</p>
          </div>
          <Link href={`${base}/calendario`} className="flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink">
            Calendario <ArrowRight className="size-4" />
          </Link>
        </div>
        <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-6">
          {quick.map((d) => {
            const level = availabilityLevel({ booked: d.booked, capacity: d.capacity, isOpen: d.isOpen });
            const full = level === "full";
            return (
              <li key={d.day} className="w-40 shrink-0 snap-start rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift sm:w-auto">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">{formatWeekdayShort(d.day)}</p>
                <p className="font-display text-3xl font-semibold text-ink tabular">{dayOfMonth(d.day)}</p>
                <div className="mt-3">
                  <SeatMeter booked={d.booked} capacity={d.capacity} size="sm" showLabel={false} />
                  <p className="mt-1.5 text-xs font-medium text-muted tabular">
                    {full ? "Completo" : `${d.capacity - d.booked} liberi`}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={full ? "secondary" : "primary"}
                  className="mt-3 w-full"
                  onClick={() => (full ? router.push(`${base}/calendario`) : setPending(d))}
                >
                  {full ? "Lista d'attesa" : "Prenota"}
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="animate-rise" >
          <CardTitle
            icon={<CalendarCheck2 />}
            eyebrow="Prenotazioni"
            action={<Link href={`${base}/prenotazioni`} className="text-sm font-semibold text-ink-soft hover:text-ink">Tutte</Link>}
          >
            In programma
          </CardTitle>
          {upcoming.length ? (
            <ul className="space-y-3">
              {upcoming.slice(0, 3).map((b) => (
                <BookingCard key={b.id} {...b} now={now} onCancel={() => onCancel(b.id)} />
              ))}
            </ul>
          ) : (
            <EmptyState icon={<CalendarDays />} title="Nessuna prenotazione">
              Scegli una giornata dal calendario: bastano due tocchi.
            </EmptyState>
          )}
        </Card>

        <Card className="animate-rise">
          <CardTitle icon={<BellRing />} eyebrow="Dai docenti">Comunicazioni</CardTitle>
          <ul className="divide-y divide-line">
            {announcements.map((a) => (
              <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                <p className="font-semibold text-ink">{a.title}</p>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted">{a.body}</p>
                <p className="mt-1 text-xs text-muted/80">{formatDateTime(a.publishedAt)}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <BookConfirmSheet
        day={pending}
        onClose={() => setPending(null)}
        onConfirm={async (d) => {
          onBook(d.day);
          return { ok: true };
        }}
      />
    </div>
  );
}
