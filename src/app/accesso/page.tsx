import { ArrowLeft, ShieldCheck } from "lucide-react";
import { AppCredit } from "@/components/layout/AppCredit";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { GoogleSignInForm } from "@/components/auth/GoogleButton";
import { LoginError } from "@/components/auth/LoginError";
import { SchoolLogo } from "@/components/brand/SchoolLogo";
import { LibraryBackdrop } from "@/components/media/LibraryPhoto";
import { AUTH, CALENDAR, ROUTES } from "@/lib/config";

export const metadata: Metadata = { title: "Accesso studenti" };

/** Schermata di accesso studenti: la biblioteca a tutto schermo. */
export default function StudentLoginPage() {
  return (
    <LibraryBackdrop overlay="login" priority position="50% 14%" className="min-h-svh">
      <div className="mx-auto flex min-h-svh max-w-6xl flex-col px-4 py-5 sm:px-6">
        <Link href={ROUTES.home} className="inline-flex w-fit items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-white/85 hover:bg-white/10 hover:text-white">
          <ArrowLeft className="size-4" /> BIBLIOVOLTA
        </Link>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[420px] animate-rise">
            <div className="rounded-2xl border border-white/40 bg-white/95 p-7 shadow-lift backdrop-blur-xl sm:p-9">
              <SchoolLogo size={60} className="mb-6" priority />
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-wood">Area studenti</p>
              <h1 className="font-display text-[1.75rem] font-semibold leading-tight text-ink text-balance">
                Bentornato in biblioteca
              </h1>
              <p className="mt-2 text-sm text-muted">
                Accedi con il tuo account della scuola per prenotare il tuo posto in aula studio.
              </p>

              <div className="mt-7 space-y-3">
                <Suspense>
                  <LoginError />
                </Suspense>
                <GoogleSignInForm />
                <p className="text-center text-xs text-muted">Al primo accesso ti chiederemo nome, cognome e classe.</p>
              </div>

              <div className="mt-7 flex gap-3 rounded-xl bg-blue-50 p-3.5 text-[13px] text-ink">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ink-soft" />
                <p>
                  Sono accettati solo gli indirizzi <strong className="font-semibold">@{AUTH.studentEmailDomain}</strong>.
                  Vedrai esclusivamente i tuoi dati e le tue prenotazioni.{" "}
                  <Link href={ROUTES.privacy} className="font-semibold underline underline-offset-2">Informativa privacy</Link>
                </p>
              </div>
            </div>
            <p className="mt-5 text-center text-sm text-white/80">
              Sei un docente?{" "}
              <Link href={ROUTES.teacherLogin} className="font-semibold text-gold underline-offset-4 hover:underline">
                Vai all&apos;area docenti
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-white/60">
          Aula studio aperta dal lunedì al venerdì · {CALENDAR.opensAt}–{CALENDAR.closesAt}
        </p>
        <AppCredit tone="light" className="-mt-2" />
      </div>
    </LibraryBackdrop>
  );
}
