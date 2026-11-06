import { TeacherActivityView } from "@/components/teacher/views/TeacherActivityView";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActivityLog } from "@/lib/teacher/data";

/** Registro delle operazioni dei docenti (audit_log). */
export default async function TeacherActivityPage() {
  await requireRole("teacher");
  const supabase = await createSupabaseServerClient();
  return <TeacherActivityView entries={await getActivityLog(supabase, 500)} />;
}
