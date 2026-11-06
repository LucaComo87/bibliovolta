import { DemoToast } from "@/components/demo/DemoToast";
import { StudentShell } from "@/components/student/StudentShell";
import { DEMO_STUDENT } from "@/lib/demo/data";
import { DemoStudentProvider } from "@/lib/demo/student-store";

export default function PreviewStudentLayout({ children }: LayoutProps<"/anteprima/studente">) {
  return (
    <DemoStudentProvider>
      <StudentShell base="/anteprima/studente" user={{ name: DEMO_STUDENT.fullName, email: DEMO_STUDENT.email, detail: `Classe ${DEMO_STUDENT.className}` }}>
        {children}
      </StudentShell>
      <DemoToast />
    </DemoStudentProvider>
  );
}
