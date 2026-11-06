"use client";

import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { cancelBooking } from "@/app/studente/actions";
import { CancelConfirmSheet } from "@/components/student/BookConfirmSheet";
import { BookingCard } from "@/components/student/BookingCards";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { StudentBookingView } from "@/lib/bookings/types";
import { useLiveClock } from "./useLiveClock";

/** "Le mie prenotazioni" nell'area personale: prenotazioni future con annullamento. */
export function UpcomingBookings({ nowIso, bookings, calendarHref }: { nowIso: string; bookings: StudentBookingView[]; calendarHref: string }) {
  const now = useLiveClock(nowIso, 60_000);
  const [cancelling, setCancelling] = useState<StudentBookingView | null>(null);
  if (!bookings.length) {
    return (
      <EmptyState icon={<CalendarDays />} title="Nessuna prenotazione in programma" action={<ButtonLink href={calendarHref}><CalendarDays /> Prenota un posto</ButtonLink>}>
        Scegli una giornata dal calendario: bastano due tocchi.
      </EmptyState>
    );
  }
  return (
    <>
      <ul className="space-y-3">
        {bookings.map((b) => (
          <BookingCard key={b.id} {...b} now={now} onCancel={() => setCancelling(b)} />
        ))}
      </ul>
      <CancelConfirmSheet
        day={cancelling?.day ?? null}
        onClose={() => setCancelling(null)}
        onConfirm={() => (cancelling ? cancelBooking(cancelling.id) : Promise.resolve({ ok: false, code: "not_found", message: "Prenotazione non trovata." }))}
      />
    </>
  );
}
