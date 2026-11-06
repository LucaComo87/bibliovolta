import { UpcomingBookings } from "@/components/student/live/UpcomingBookings";
import { StudentWelcome } from "@/components/student/views/StudentWelcome";
import { requireRole } from "@/lib/auth/session";
import { getMyBookings, getMyWaitlist } from "@/lib/bookings/server";
import { activeWaitlist } from "@/lib/bookings/waitlist-view";
import { ROUTES } from "@/lib/config";
import { todayInRome } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Area personale reale. Tutte le letture usano la sessione dello studente:
 * la RLS e le funzioni del database restituiscono solo i suoi dati.
 */
export default async function StudentHomePage() {
  const user = await requireRole("student");
  const supabase = await createSupabaseServerClient();
  const today = todayInRome();

  const [bookings, waits, { data: announcements }] = await Promise.all([
    getMyBookings(supabase),
    getMyWaitlist(supabase),
    supabase
      .from("announcements")
      .select("id, title, body, published_at")
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(3),
  ]);

  const upcoming = bookings.filter((b) => b.status === "confirmed" && b.day >= today);
  const next = upcoming[0];

  return (
    <StudentWelcome
      firstName={user.profile.first_name ?? ""}
      lastName={user.profile.last_name ?? ""}
      className={user.profile.class_name}
      email={user.email}
      calendarHref={`${ROUTES.student}/calendario`}
      nextBooking={next ? { day: next.day, opensAt: next.opensAt ?? "", closesAt: next.closesAt ?? "" } : null}
      dataExportHref={`${ROUTES.student}/i-miei-dati`}
      bookingsContent={<UpcomingBookings nowIso={new Date().toISOString()} bookings={upcoming} calendarHref={`${ROUTES.student}/calendario`} />}
      waitlist={activeWaitlist(waits).map((w) => ({ id: w.id, day: w.day, status: w.status, position: w.position, offerExpiresAt: w.offerExpiresAt }))}
      announcements={(announcements ?? []).map((a) => ({ id: a.id, title: a.title, body: a.body, publishedAt: a.published_at! }))}
    />
  );
}
