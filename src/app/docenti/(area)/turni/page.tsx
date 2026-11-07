import { LiveTeacherShifts } from "@/components/teacher/live/LiveTeacherShifts";
import { requireRole } from "@/lib/auth/session";
import { getSeasonCalendar } from "@/lib/bookings/server";
import { todayInRome } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMaxShiftsPerDay, getShiftMap } from "@/lib/teacher/shifts";

/** Turni di sorveglianza: docenti di turno per ogni giornata. */
export default async function TeacherShiftsPage() {
  const user = await requireRole("teacher");
  const supabase = await createSupabaseServerClient();
  const [days, shifts, maxPerDay] = await Promise.all([getSeasonCalendar(supabase), getShiftMap(supabase, user.id), getMaxShiftsPerDay(supabase)]);
  return <LiveTeacherShifts today={todayInRome()} days={days} shifts={shifts} viewer={{ id: user.id, isAdmin: user.profile.is_admin, maxPerDay }} />;
}
