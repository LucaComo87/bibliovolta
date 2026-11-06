import { TeacherStatsView } from "@/components/teacher/views/TeacherStatsView";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toStatsData } from "@/lib/teacher/stats";

/** Statistiche reali calcolate dal database (teacher_stats). */
export default async function TeacherStatsPage() {
  await requireRole("teacher");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("teacher_stats");
  if (error || !data) throw new Error(error?.message ?? "Statistiche non disponibili.");
  return <TeacherStatsView stats={toStatsData(data)} />;
}
