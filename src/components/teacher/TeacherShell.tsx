"use client";

import { AppCredit } from "@/components/layout/AppCredit";
import { BarChart3, CalendarCog, Hourglass, KeyRound, LayoutDashboard, LogOut, Megaphone, ScrollText, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BrandLockup } from "@/components/brand/BrandMark";
import { LibraryBackdrop } from "@/components/media/LibraryPhoto";
import { Avatar } from "@/components/ui/Avatar";
import type { ShellUser } from "@/components/student/StudentShell";
import { cn } from "@/lib/cn";

export const teacherNav = [
  { slug: "", label: "Dashboard", icon: LayoutDashboard },
  { slug: "/calendario", label: "Calendario", icon: CalendarCog },
  { slug: "/turni", label: "Turni", icon: ShieldCheck },
  { slug: "/lista-attesa", label: "Lista d'attesa", icon: Hourglass },
  { slug: "/iscritti", label: "Iscritti", icon: Users },
  { slug: "/comunicazioni", label: "Comunicazioni", icon: Megaphone },
  { slug: "/statistiche", label: "Statistiche", icon: BarChart3 },
  { slug: "/registro", label: "Registro", icon: ScrollText },
] as const;

/** Struttura dell'area docenti: barra laterale su desktop, schede scorrevoli su smartphone. */
export function TeacherShell({
  base,
  user,
  children,
  signOutAction,
  passwordHref,
}: {
  base: string;
  user: ShellUser | null;
  children: ReactNode;
  /** Server Action di uscita; assente nell'anteprima */
  signOutAction?: () => Promise<void>;
  passwordHref?: string;
}) {
  const pathname = usePathname();
  const isActive = (slug: string) => (slug === "" ? pathname === base : pathname.startsWith(base + slug));

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[264px_1fr]">
      {/* barra laterale desktop */}
      <aside className="sticky top-0 hidden h-svh flex-col bg-ink text-white lg:flex">
        <LibraryBackdrop overlay="banner" source="panorama" position="50% 25%" sizes="264px" className="h-36">
          <div className="flex h-full flex-col justify-between p-5">
            <Link href={base}><BrandLockup tone="light" /></Link>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">Area docenti</p>
          </div>
        </LibraryBackdrop>
        <nav aria-label="Area docenti" className="flex-1 p-3">
          <ul className="space-y-1">
            {teacherNav.map(({ slug, label, icon: Icon }) => (
              <li key={slug}>
                <Link
                  href={base + slug}
                  aria-current={isActive(slug) ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                    isActive(slug) ? "bg-white/10 text-white shadow-[inset_3px_0_0_var(--gold)]" : "text-white/65 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <Icon className="size-[18px]" /> {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {user && (
          <div className="flex items-center gap-3 border-t border-white/10 p-4">
            <Avatar name={user.name} size="sm" className="ring-offset-ink" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-white/60">{user.detail ?? user.email}</p>
            </div>
            {passwordHref && (
              <Link href={passwordHref} className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Cambia password" title="Cambia password">
                <KeyRound className="size-4" />
              </Link>
            )}
            <form action={signOutAction}>
              <button
                type="submit"
                disabled={!signOutAction}
                className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-50"
                aria-label="Esci"
                title={signOutAction ? "Esci" : "Non disponibile nell'anteprima"}
              >
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* intestazione smartphone/tablet */}
        <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur-md lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <Link href={base}><BrandLockup compact /></Link>
            {user && (
              <div className="flex items-center gap-1">
                {passwordHref && (
                  <Link href={passwordHref} className="rounded-lg p-2 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Cambia password">
                    <KeyRound className="size-4" />
                  </Link>
                )}
                <form action={signOutAction}>
                  <button type="submit" disabled={!signOutAction} className="rounded-lg p-2 text-muted hover:bg-ink/5 hover:text-ink disabled:opacity-50" aria-label="Esci">
                    <LogOut className="size-4" />
                  </button>
                </form>
                <Avatar name={user.name} size="sm" />
              </div>
            )}
          </div>
          <nav aria-label="Area docenti" className="overflow-x-auto px-2 pb-2">
            <ul className="flex w-max gap-1">
              {teacherNav.map(({ slug, label, icon: Icon }) => (
                <li key={slug}>
                  <Link
                    href={base + slug}
                    aria-current={isActive(slug) ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition",
                      isActive(slug) ? "bg-ink text-white" : "text-muted hover:bg-ink/5",
                    )}
                  >
                    <Icon className="size-4" /> {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-8 sm:py-10">{children}<AppCredit className="mt-12" /></main>
      </div>
    </div>
  );
}
