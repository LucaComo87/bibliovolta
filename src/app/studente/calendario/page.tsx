import { LiveCalendar } from "@/components/student/live/LiveCalendar";
import { requireRole } from "@/lib/auth/session";
import { getMyBookings, getMyWaitlist, getSeasonCalendar } from "@/lib/bookings/server";
import { activeWaitlist } from "@/lib/bookings/waitlist-view";
import { todayInRome } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Calendario reale della stagione, collegato a Supabase. */
export default async function StudentCalendarPage() {
  const user = await requireRole("student");
  const supabase = await createSupabaseServerClient();
  const [days, bookings, waits] = await Promise.all([getSeasonCalendar(supabase), getMyBookings(supabase), getMyWaitlist(supabase)]);
  return (
    <LiveCalendar
      today={todayInRome()}
      nowIso={new Date().toISOString()}
      days={days}
      bookings={bookings}
      waitlist={activeWaitlist(waits)}
      profile={{ name: `${user.profile.first_name ?? ""} ${user.profile.last_name ?? ""}`.trim() || user.profile.full_name, className: user.profile.class_name }}
    />
  );
}
