"use client";

import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { CancelConfirmSheet } from "@/components/student/BookConfirmSheet";
import { BookingCard } from "@/components/student/BookingCards";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeading } from "@/components/ui/PageHeading";
import { cn } from "@/lib/cn";
import type { BookingResult, StudentBookingView } from "@/lib/bookings/types";

const tabs = [
  { id: "upcoming", label: "In programma" },
  { id: "past", label: "Passate" },
  { id: "cancelled", label: "Annullate" },
] as const;

export function StudentBookingsView({
  base,
  today,
  now,
  bookings,
  onCancel,
}: {
  base: string;
  today: string;
  now: Date;
  bookings: StudentBookingView[];
  onCancel: (id: string) => Promise<BookingResult>;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("upcoming");
  const [cancelling, setCancelling] = useState<StudentBookingView | null>(null);
  const groups = {
    upcoming: bookings.filter((b) => b.status === "confirmed" && b.day >= today).sort((a, b) => a.day.localeCompare(b.day)),
    past: bookings.filter((b) => b.status !== "cancelled" && b.day < today).sort((a, b) => b.day.localeCompare(a.day)),
    cancelled: bookings.filter((b) => b.status === "cancelled"),
  };
  const list = groups[tab];

  return (
    <>
      <PageHeading
        eyebrow="Prenotazioni"
        title="Le tue prenotazioni"
        action={<ButtonLink href={`${base}/calendario`}><CalendarDays /> Nuova prenotazione</ButtonLink>}
      >
        Puoi annullare una prenotazione fino a 24 ore prima dell&apos;apertura.
      </PageHeading>

      <div role="tablist" aria-label="Filtra prenotazioni" className="mb-5 inline-flex rounded-xl border border-line bg-surface p-1 shadow-soft">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-lg px-3.5 py-2 text-sm font-semibold transition",
              tab === t.id ? "bg-ink text-white" : "text-muted hover:text-ink",
            )}
          >
            {t.label} <span className="ml-1 opacity-70 tabular">{groups[t.id].length}</span>
          </button>
        ))}
      </div>

      {list.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((b) => (
            <BookingCard key={b.id} {...b} status={b.day < today && b.status === "confirmed" ? "attended" : b.status} now={now} onCancel={() => setCancelling(b)} />
          ))}
        </ul>
      ) : (
        <EmptyState icon={<CalendarDays />} title="Nessuna prenotazione in questa sezione" />
      )}
      <CancelConfirmSheet
        day={cancelling?.day ?? null}
        onClose={() => setCancelling(null)}
        onConfirm={() => (cancelling ? onCancel(cancelling.id) : Promise.resolve({ ok: false, code: "not_found", message: "Prenotazione non trovata." }))}
      />
    </>
  );
}
