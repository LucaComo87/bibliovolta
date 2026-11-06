import type { Metadata } from "next";
import { Suspense } from "react";
import { AreaLoading } from "@/components/auth/AreaLoading";
import { TeacherShell } from "@/components/teacher/TeacherShell";
import { signOut } from "@/lib/auth/actions";
import { requireRole } from "@/lib/auth/session";
import { ROUTES } from "@/lib/config";

export const metadata: Metadata = { title: "Area docenti" };

export default function TeacherLayout({ children }: LayoutProps<"/docenti">) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl p-6"><AreaLoading /></div>}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}

/** Protetta lato server: solo docenti attivi. */
async function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const { profile } = await requireRole("teacher");
  return (
    <TeacherShell
      base={ROUTES.teacher}
      user={{ name: profile.full_name || profile.email, email: profile.email, detail: profile.is_admin ? "Amministratore" : "Docente" }}
      signOutAction={signOut}
      passwordHref={ROUTES.teacherPassword}
    >
      {children}
    </TeacherShell>
  );
}
