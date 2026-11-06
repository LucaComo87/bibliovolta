"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/** Schede di navigazione orizzontali (scorrono su smartphone). */
export function SegmentedNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Sezioni">
      <ul className="flex w-max gap-1 rounded-xl border border-line bg-surface p-1 shadow-soft">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-lg px-3.5 py-2 text-sm font-semibold transition",
                  active ? "bg-ink text-white" : "text-muted hover:bg-ink/5 hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
