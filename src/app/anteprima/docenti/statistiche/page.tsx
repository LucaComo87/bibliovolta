import { TeacherStatsView } from "@/components/teacher/views/TeacherStatsView";
import { DEMO_STATS_V6 } from "@/lib/demo/data";

export default function PreviewTeacherStats() {
  return <TeacherStatsView stats={DEMO_STATS_V6} note="Anteprima con dati dimostrativi." />;
}
