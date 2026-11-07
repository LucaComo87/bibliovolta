import { OpeningHoursForm } from "@/components/teacher/OpeningHoursForm";
import { LiveTeacherCalendar } from "@/components/teacher/live/LiveTeacherCalendar";
import { requireRole } from "@/lib/auth/session";
import { getSeasonCalendar } from "@/lib/bookings/server";
import { ROUTES } from "@/lib/config";
import { formatTime, todayInRome } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMaxShiftsPerDay, getShiftMap } from "@/lib/teacher/shifts";

/** Calendario gestionale reale (aperture, chiusure, orari, capienza, note). */
export default async function TeacherCalendarPage() {
  const user = await requireRole("teacher");
  const supabase = await createSupabaseServerClient();
  const [days, { data: settings }, shifts, maxPerDay] = await Promise.all([
    getSeasonCalendar(supabase),
    supabase.from("app_settings").select("default_opens_at, default_closes_at, cancellation_hours").eq("id", 1).single(),
    getShiftMap(supabase, user.id),
    getMaxShiftsPerDay(supabase),
  ]);
  return (
    <LiveTeacherCalendar
      base={ROUTES.teacher}
      today={todayInRome()}
      days={days}
      shifts={shifts}
      viewer={{ id: user.id, isAdmin: user.profile.is_admin, maxPerDay }}
      aside={
        <OpeningHoursForm
          opensAt={formatTime(settings?.default_opens_at ?? "14:15")}
          closesAt={formatTime(settings?.default_closes_at ?? "16:30")}
          cancellationHours={settings?.cancellation_hours ?? 24}
        />
      }
    />
  );
}
