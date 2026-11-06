import { ArrowLeft, LogOut } from "lucide-react";
import { AppCredit } from "@/components/layout/AppCredit";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AreaLoading } from "@/components/auth/AreaLoading";
import { PasswordChangeForm } from "@/components/auth/PasswordChangeForm";
import { BrandLockup } from "@/components/brand/BrandMark";
import { SchoolLogo } from "@/components/brand/SchoolLogo";
import { LibraryBackdrop } from "@/components/media/LibraryPhoto";
import { signOut } from "@/lib/auth/actions";
import { requireRole } from "@/lib/auth/session";
import { ROUTES } from "@/lib/config";

export const metadata: Metadata = { title: "Cambia password" };

export default function TeacherPasswordPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      <LibraryBackdrop overlay="banner" position="50% 18%" sizes="(min-width: 1024px) 55vw, 100vw" className="hidden lg:block">
        <div className="flex h-full flex-col justify-between p-10 text-white">
          <BrandLockup tone="light" />
          <div className="max-w-md">
            <span className="gold-rule mb-5 block" />
            <h2 className="font-display text-4xl font-semibold leading-tight text-balance">Una password personale, solo tua.</h2>
            <p className="mt-3 text-white/80">Protegge i dati degli studenti e il registro delle operazioni.</p>
          </div>
        </div>
      </LibraryBackdrop>
      <main className="flex flex-col bg-surface px-4 py-5 sm:px-10">
        <div className="flex items-center justify-between">
          <span className="lg:hidden"><BrandLockup compact /></span>
          <form action={signOut} className="ml-auto">
            <button className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
              <LogOut className="size-4" /> Esci
            </button>
          </form>
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm animate-rise">
            <SchoolLogo size={60} className="mb-6" priority />
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-wood">Area docenti</p>
            <h1 className="font-display text-3xl font-semibold text-ink">Cambia password</h1>
            <Suspense fallback={<div className="mt-6"><AreaLoading /></div>}>
              <PasswordSection />
            </Suspense>
          </div>
        </div>
        <AppCredit className="pb-6" />
      </main>
    </div>
  );
}

async function PasswordSection() {
  const user = await requireRole("teacher", { allowPasswordChange: true });
  return (
    <>
      <p className="mt-2 text-sm text-muted">Account: <strong className="text-ink">{user.email}</strong></p>
      {!user.mustChangePassword && (
        <Link href={ROUTES.teacher} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink">
          <ArrowLeft className="size-4" /> Torna alla dashboard
        </Link>
      )}
      <PasswordChangeForm forced={user.mustChangePassword} />
    </>
  );
}
