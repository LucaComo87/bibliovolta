import { TeacherActivityView } from "@/components/teacher/views/TeacherActivityView";
import { DEMO_ACTIVITY } from "@/lib/demo/data";

export default function PreviewTeacherActivity() {
  return <TeacherActivityView entries={DEMO_ACTIVITY} />;
}
