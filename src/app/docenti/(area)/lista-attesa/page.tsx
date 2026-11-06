import { LiveTeacherWaitlist } from "@/components/teacher/live/LiveTeacherWaitlist";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWaitlistDashboard } from "@/lib/waitlist/teacher";

export default async function TeacherWaitlistPage() {
  await requireRole("teacher");
  const supabase = await createSupabaseServerClient();
  const data = await getWaitlistDashboard(supabase);
  return <LiveTeacherWaitlist data={data} nowIso={new Date().toISOString()} />;
}
