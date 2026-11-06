import { TeacherDashboard } from "@/components/teacher/views/TeacherDashboard";
import { requireRole } from "@/lib/auth/session";
import { ROUTES } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/teacher/data";

/** Dashboard docenti con dati reali. */
export default async function TeacherDashboardPage() {
  const user = await requireRole("teacher");
  const supabase = await createSupabaseServerClient();
  const data = await getDashboardData(supabase);
  return <TeacherDashboard base={ROUTES.teacher} teacherName={user.profile.full_name || user.email} data={data} />;
}
