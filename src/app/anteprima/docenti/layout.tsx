import { TeacherShell } from "@/components/teacher/TeacherShell";
import { DEMO_TEACHER } from "@/lib/demo/data";

export default function PreviewTeacherLayout({ children }: LayoutProps<"/anteprima/docenti">) {
  return (
    <TeacherShell base="/anteprima/docenti" user={{ name: DEMO_TEACHER.fullName, email: DEMO_TEACHER.email, detail: "Amministratrice" }}>
      {children}
    </TeacherShell>
  );
}
