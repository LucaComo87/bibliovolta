import { OpeningHoursForm } from "@/components/teacher/OpeningHoursForm";
import { LiveTeacherCalendar } from "@/components/teacher/live/LiveTeacherCalendar";
import { requireRole } from "@/lib/auth/session";
import { getSeasonCalendar } from "@/lib/bookings/server";
import { ROUTES } from "@/lib/config";
import { formatTime, todayInRome } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Calendario gestionale reale (aperture, chiusure, orari, capienza, note). */
export default async function TeacherCalendarPage() {
  await requireRole("teacher");
  const supabase = await createSupabaseServerClient();
  const [days, { data: settings }] = await Promise.all([
    getSeasonCalendar(supabase),
    supabase.from("app_settings").select("default_opens_at, default_closes_at, cancellation_hours").eq("id", 1).single(),
  ]);
  return (
    <LiveTeacherCalendar
      base={ROUTES.teacher}
      today={todayInRome()}
      days={days}
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
