"use client";

import { acceptMyOffer, bookSeat, cancelBooking, declineMyOffer, joinWaitlist, leaveWaitlist } from "@/app/studente/actions";
import type { ProfileSummary } from "@/components/student/BookConfirmSheet";
import { StudentCalendarView } from "@/components/student/views/StudentCalendarView";
import type { StudentBookingView } from "@/lib/bookings/types";
import type { StudentWaitlist } from "@/components/student/views/StudentHome";
import type { CalendarDay } from "@/lib/calendar";
import { useLiveClock } from "./useLiveClock";

/** Calendario reale: dati dal database, azioni tramite Server Actions. */
export function LiveCalendar({
  today,
  nowIso,
  days,
  bookings,
  waitlist,
  profile,
  initialDay,
}: {
  today: string;
  nowIso: string;
  days: CalendarDay[];
  bookings: StudentBookingView[];
  waitlist: StudentWaitlist[];
  profile: ProfileSummary;
  initialDay?: string;
}) {
  const now = useLiveClock(nowIso);
  return (
    <StudentCalendarView
      today={today}
      now={now}
      days={days}
      bookings={bookings}
      waitlist={waitlist}
      profile={profile}
      waitlistAvailable
      initialDay={initialDay}
      onBook={(d) => (d.id ? bookSeat(d.id) : Promise.resolve({ ok: false, code: "not_found", message: "Giornata non valida." }))}
      onCancel={cancelBooking}
      onJoinWaitlist={(d) => (d.id ? joinWaitlist(d.id) : Promise.resolve({ ok: false, code: "not_found", message: "Giornata non valida." }))}
      onLeaveWaitlist={leaveWaitlist}
      onAcceptOffer={acceptMyOffer}
      onDeclineOffer={declineMyOffer}
    />
  );
}
