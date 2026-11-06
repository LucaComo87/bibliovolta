"use client";

import { useRef, useState, useTransition } from "react";
import { Notice } from "@/components/ui/Notice";
import { DayCard, type StudentDayState } from "@/components/calendar/DayCard";
import { MonthCalendar, type DayMarker } from "@/components/calendar/MonthCalendar";
import { BookConfirmSheet, CancelConfirmSheet, type ProfileSummary } from "@/components/student/BookConfirmSheet";
import { PageHeading } from "@/components/ui/PageHeading";
import type { BookingResult, StudentBookingView } from "@/lib/bookings/types";
import type { CalendarDay } from "@/lib/calendar";
import type { StudentWaitlist } from "./StudentHome";

/**
 * Calendario dello studente: mese → giornata → conferma.
 * Riceve i dati e le azioni come props: nell'app reale arrivano dal
 * database e dalle Server Actions, nell'anteprima dai dati dimostrativi.
 */
export function StudentCalendarView({
  today,
  now,
  days,
  bookings,
  waitlist,
  profile,
  onBook,
  onCancel,
  onJoinWaitlist,
  onLeaveWaitlist,
  onAcceptOffer,
  onDeclineOffer,
  waitlistAvailable = true,
  initialDay,
}: {
  today: string;
  now: Date;
  days: CalendarDay[];
  bookings: StudentBookingView[];
  waitlist: StudentWaitlist[];
  profile?: ProfileSummary;
  onBook: (day: CalendarDay) => Promise<BookingResult>;
  onCancel: (bookingId: string) => Promise<BookingResult>;
  onJoinWaitlist?: (day: CalendarDay) => Promise<BookingResult & { position?: number }> | void;
  onLeaveWaitlist?: (entryId: string) => Promise<BookingResult> | void;
  onAcceptOffer?: (offerId: string) => Promise<BookingResult> | void;
  onDeclineOffer?: (offerId: string) => Promise<BookingResult> | void;
  waitlistAvailable?: boolean;
  initialDay?: string;
}) {
  const firstOpen =
    days.find((d) => d.day >= today && d.isOpen && d.booked < d.capacity && !bookings.some((b) => b.day === d.day && b.status === "confirmed"))?.day ??
    days.find((d) => d.day >= today)?.day ??
    days[0]?.day ??
    null;
  const [selected, setSelected] = useState<string | null>(initialDay ?? firstOpen);
  const [pending, setPending] = useState<CalendarDay | null>(null);
  const [cancelling, setCancelling] = useState<StudentBookingView | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState<{ tone: "info" | "danger"; text: string } | null>(null);
  const [busy, startTransition] = useTransition();

  /** Esegue un'azione della lista d'attesa e mostra l'esito sopra la scheda. */
  function run(fn: () => Promise<(BookingResult & { position?: number }) | void> | void, success: (r: BookingResult & { position?: number }) => string) {
    setMessage(null);
    startTransition(async () => {
      const r = await fn();
      if (!r) return;
      setMessage(r.ok ? { tone: "info", text: success(r) } : { tone: "danger", text: r.message });
    });
  }

  const markers: Record<string, DayMarker> = {};
  bookings.filter((b) => b.status === "confirmed").forEach((b) => (markers[b.day] = "booked"));
  waitlist.forEach((w) => (markers[w.day] ??= "waitlisted"));

  const day = days.find((d) => d.day === selected);
  const booking = bookings.find((b) => b.day === selected && b.status === "confirmed");
  const wait = waitlist.find((w) => w.day === selected);
  const state: StudentDayState = booking ? "booked" : wait ? (wait.status === "offered" ? "offered" : "waitlisted") : "none";

  function select(d: string) {
    setSelected(d);
    setMessage(null);
    // su smartphone porta la scheda della giornata in vista
    if (window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  return (
    <>
      <PageHeading eyebrow="Calendario" title="Scegli il tuo pomeriggio">
        Tocca una giornata per vedere i posti liberi e prenotare.
      </PageHeading>
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <div className="animate-rise">
          <MonthCalendar days={days} today={today} selected={selected} onSelect={select} markers={markers} />
        </div>
        <div ref={detailRef} className="scroll-mt-20 animate-rise lg:sticky lg:top-24" style={{ animationDelay: "90ms" }}>
          {message && (
            <Notice tone={message.tone} className="mb-3">
              {message.text}
            </Notice>
          )}
          {day && (
            <DayCard
              key={day.day}
              day={day}
              today={today}
              now={now}
              state={state}
              waitlistPosition={wait?.position}
              offerExpiresAt={wait?.offerExpiresAt}
              busy={busy}
              cancelDeadline={booking?.cancelDeadline ? new Date(booking.cancelDeadline) : undefined}
              waitlistAvailable={waitlistAvailable && day.waitlistOpen !== false}
              onBook={() => setPending(day)}
              onCancel={() => booking && setCancelling(booking)}
              onJoinWaitlist={() => run(() => onJoinWaitlist?.(day), (r) => `Sei in lista d'attesa: posizione ${r.position ?? "?"}. Se si libera un posto riceverai un'email.`)}
              onLeaveWaitlist={() => wait && run(() => onLeaveWaitlist?.(wait.id), () => "Sei uscito dalla lista d'attesa.")}
              onAcceptOffer={() => wait?.offerId && run(() => onAcceptOffer?.(wait.offerId!), () => "Posto confermato! Lo trovi tra le tue prenotazioni.")}
              onDeclineOffer={() => wait?.offerId && run(() => onDeclineOffer?.(wait.offerId!), () => "Hai rinunciato al posto: è stato proposto allo studente successivo.")}
            />
          )}
        </div>
      </div>
      <BookConfirmSheet day={pending} profile={profile} onClose={() => setPending(null)} onConfirm={onBook} />
      <CancelConfirmSheet
        day={cancelling?.day ?? null}
        onClose={() => setCancelling(null)}
        onConfirm={() => (cancelling ? onCancel(cancelling.id) : Promise.resolve({ ok: false, code: "not_found", message: "Prenotazione non trovata." }))}
      />
    </>
  );
}
