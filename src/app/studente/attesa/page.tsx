import { LiveWaitlist } from "@/components/student/live/LiveWaitlist";
import { requireRole } from "@/lib/auth/session";
import { getMyWaitlist } from "@/lib/bookings/server";
import { activeWaitlist, offerHistory } from "@/lib/bookings/waitlist-view";
import { ROUTES } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** LE MIE LISTE D'ATTESA: dati reali dal database. */
export default async function StudentWaitlistPage() {
  await requireRole("student");
  const supabase = await createSupabaseServerClient();
  const [rows, { data: settings }] = await Promise.all([
    getMyWaitlist(supabase),
    supabase.from("app_settings").select("offer_minutes").eq("id", 1).single(),
  ]);
  return (
    <LiveWaitlist
      base={ROUTES.student}
      nowIso={new Date().toISOString()}
      waitlist={activeWaitlist(rows)}
      history={offerHistory(rows)}
      offerMinutes={settings?.offer_minutes ?? 120}
    />
  );
}
