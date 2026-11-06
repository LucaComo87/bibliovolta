import { LiveBookings } from "@/components/student/live/LiveBookings";
import { requireRole } from "@/lib/auth/session";
import { getMyBookings } from "@/lib/bookings/server";
import { ROUTES } from "@/lib/config";
import { todayInRome } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function StudentBookingsPage() {
  await requireRole("student");
  const supabase = await createSupabaseServerClient();
  const bookings = await getMyBookings(supabase);
  return <LiveBookings base={ROUTES.student} today={todayInRome()} nowIso={new Date().toISOString()} bookings={bookings} />;
}
