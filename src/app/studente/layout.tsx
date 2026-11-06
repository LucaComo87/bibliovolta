import type { Metadata } from "next";
import { Suspense } from "react";
import { AreaLoading } from "@/components/auth/AreaLoading";
import { StudentShell } from "@/components/student/StudentShell";
import { signOut } from "@/lib/auth/actions";
import { requireRole } from "@/lib/auth/session";
import { ROUTES } from "@/lib/config";

export const metadata: Metadata = { title: "Area studente" };

export default function StudentLayout({ children }: LayoutProps<"/studente">) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl p-6"><AreaLoading /></div>}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}

/** Protetta lato server: solo studenti attivi (la RLS protegge comunque i dati). */
async function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const { profile } = await requireRole("student");
  return (
    <StudentShell
      base={ROUTES.student}
      user={{ name: profile.full_name || profile.email, email: profile.email, detail: profile.class_name ? `Classe ${profile.class_name}` : undefined }}
      signOutAction={signOut}
    >
      {children}
    </StudentShell>
  );
}
