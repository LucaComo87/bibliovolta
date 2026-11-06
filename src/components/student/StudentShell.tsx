"use client";

import { AppCredit } from "@/components/layout/AppCredit";
import { CalendarDays, Hourglass, House, LogOut, Ticket } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BrandLockup } from "@/components/brand/BrandMark";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";

export type ShellUser = { name: string; email: string; detail?: string };

export const studentNav = [
  { slug: "", label: "Home", icon: House },
  { slug: "/calendario", label: "Calendario", icon: CalendarDays },
  { slug: "/prenotazioni", label: "Prenotazioni", icon: Ticket },
  { slug: "/attesa", label: "Liste d'attesa", icon: Hourglass },
] as const;

/**
 * Struttura dell'area studente: barra superiore su desktop,
 * barra di navigazione in basso su smartphone (a portata di pollice).
 */
export function StudentShell({
  base,
  user,
  children,
  signOutAction,
}: {
  base: string;
  user: ShellUser | null;
  children: ReactNode;
  /** Server Action di uscita; assente nell'anteprima */
  signOutAction?: () => Promise<void>;
}) {
  const pathname = usePathname();
  const isActive = (slug: string) => (slug === "" ? pathname === base : pathname.startsWith(base + slug));

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href={base} aria-label="Area studente, home">
            <BrandLockup compact />
          </Link>
          <nav aria-label="Area studente" className="hidden md:block">
            <ul className="flex gap-1">
              {studentNav.map(({ slug, label, icon: Icon }) => (
                <li key={slug}>
                  <Link
                    href={base + slug}
                    aria-current={isActive(slug) ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition",
                      isActive(slug) ? "bg-blue-50 text-ink" : "text-muted hover:bg-ink/5 hover:text-ink",
                    )}
                  >
                    <Icon className="size-4" /> {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {user && (
            <div className="flex items-center gap-3">
              <div className="hidden text-right lg:block">
                <p className="text-sm font-semibold leading-tight text-ink">{user.name}</p>
                <p className="text-xs text-muted">{user.detail ?? user.email}</p>
              </div>
              <Avatar name={user.name} size="sm" />
              <form action={signOutAction}>
                <button
                  type="submit"
                  disabled={!signOutAction}
                  className="rounded-lg p-2 text-muted hover:bg-ink/5 hover:text-ink disabled:opacity-50"
                  aria-label="Esci"
                  title={signOutAction ? "Esci" : "Non disponibile nell'anteprima"}
                >
                  <LogOut className="size-4" />
                </button>
              </form>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pt-10 md:pb-16">{children}<AppCredit className="mt-12" /></main>

      {/* barra inferiore su smartphone */}
      <nav aria-label="Area studente" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-safe backdrop-blur-md md:hidden">
        <ul className="grid grid-cols-4">
          {studentNav.map(({ slug, label, icon: Icon }) => {
            const active = isActive(slug);
            return (
              <li key={slug}>
                <Link
                  href={base + slug}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold", active ? "text-ink" : "text-muted")}
                >
                  <span className={cn("grid h-7 w-12 place-items-center rounded-full transition", active && "bg-gold-soft text-wood")}>
                    <Icon className="size-[19px]" />
                  </span>
                  {label === "Liste d'attesa" ? "Attesa" : label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
