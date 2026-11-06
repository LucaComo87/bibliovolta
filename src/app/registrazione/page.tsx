import { LogOut } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AreaLoading } from "@/components/auth/AreaLoading";
import { RegistrationForm } from "@/components/auth/RegistrationForm";
import { SchoolLogo } from "@/components/brand/SchoolLogo";
import { LibraryBackdrop } from "@/components/media/LibraryPhoto";
import { signOut } from "@/lib/auth/actions";
import { requireRole } from "@/lib/auth/session";
import { ROUTES } from "@/lib/config";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Registrazione" };

/** Primo accesso dello studente: nome, cognome e classe. */
export default function RegistrationPage() {
  return (
    <LibraryBackdrop overlay="login" priority position="50% 14%" className="min-h-svh">
      <div className="mx-auto flex min-h-svh max-w-6xl flex-col px-4 py-5 sm:px-6">
        <form action={signOut} className="self-end">
          <button className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-white/85 hover:bg-white/10 hover:text-white">
            <LogOut className="size-4" /> Esci
          </button>
        </form>
        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-[460px] animate-rise rounded-2xl border border-white/40 bg-white/95 p-7 shadow-lift backdrop-blur-xl sm:p-9">
            <SchoolLogo size={60} className="mb-6" priority />
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-wood">Primo accesso</p>
            <h1 className="font-display text-[1.75rem] font-semibold leading-tight text-ink text-balance">Completa la registrazione</h1>
            <p className="mt-2 text-sm text-muted">Ci servono pochi dati, solo la prima volta. Li vedranno i docenti che gestiscono l&apos;aula studio.</p>
            <Suspense fallback={<div className="mt-7"><AreaLoading /></div>}>
              <RegistrationSection />
            </Suspense>
          </div>
        </div>
      </div>
    </LibraryBackdrop>
  );
}

async function RegistrationSection() {
  const user = await requireRole("student", { allowUnregistered: true });
  if (!user.needsRegistration) redirect(ROUTES.student);
  // precompilazione (modificabile): nome e cognome di Google, o il nome completo diviso al primo spazio
  const [guessFirst, ...rest] = (user.profile.full_name ?? "").trim().split(/\s+/);
  return (
    <RegistrationForm
      email={user.email}
      firstName={user.profile.first_name ?? guessFirst ?? ""}
      lastName={user.profile.last_name ?? rest.join(" ")}
    />
  );
}
