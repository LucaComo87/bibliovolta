"use client";

import { cancelBooking } from "@/app/studente/actions";
import { StudentBookingsView } from "@/components/student/views/StudentBookingsView";
import type { StudentBookingView } from "@/lib/bookings/types";
import { useLiveClock } from "./useLiveClock";

export function LiveBookings({ base, today, nowIso, bookings }: { base: string; today: string; nowIso: string; bookings: StudentBookingView[] }) {
  const now = useLiveClock(nowIso, 60_000);
  return <StudentBookingsView base={base} today={today} now={now} bookings={bookings} onCancel={cancelBooking} />;
}
