import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BrandLockup } from "@/components/brand/BrandMark";
import { SchoolLogo } from "@/components/brand/SchoolLogo";
import { LibraryBackdrop } from "@/components/media/LibraryPhoto";
import { TeacherLoginForm } from "@/components/auth/TeacherLoginForm";
import { ROUTES } from "@/lib/config";

export const metadata: Metadata = { title: "Accesso docenti" };

/** Accesso docenti: fotografia a sinistra (desktop), modulo a destra. */
export default function TeacherLoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      <LibraryBackdrop overlay="banner" priority position="50% 30%" sizes="(min-width: 1024px) 55vw, 100vw" className="hidden lg:block">
        <div className="flex h-full flex-col justify-between p-10 text-white">
          <Link href={ROUTES.home}>
            <BrandLockup tone="light" />
          </Link>
          <div className="max-w-md">
            <span className="gold-rule mb-5 block" />
            <h2 className="font-display text-4xl font-semibold leading-tight text-balance">
              Gestisci l&apos;aula studio della biblioteca storica.
            </h2>
            <p className="mt-3 text-white/80">
              Calendario, chiusure, elenchi degli iscritti, comunicazioni e statistiche in un unico spazio.
            </p>
          </div>
        </div>
      </LibraryBackdrop>

      <main className="flex flex-col bg-surface px-4 py-5 sm:px-10">
        <div className="flex items-center justify-between lg:justify-end">
          <Link href={ROUTES.home} className="lg:hidden">
            <BrandLockup compact />
          </Link>
          <Link href={ROUTES.login} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
            <ArrowLeft className="size-4" /> Accesso studenti
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm animate-rise">
            <SchoolLogo size={60} className="mb-6" priority />
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-wood">Area docenti</p>
            <h1 className="font-display text-3xl font-semibold text-ink">Accedi</h1>
            <p className="mt-2 text-sm text-muted">Usa le credenziali fornite dall&apos;amministratore della piattaforma.</p>

            <TeacherLoginForm />
          </div>
        </div>
      </main>
    </div>
  );
}
