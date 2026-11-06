"use client";

import { CalendarClock, Hourglass, ListOrdered, MailCheck, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { WaitlistCard } from "@/components/student/BookingCards";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { PageHeading } from "@/components/ui/PageHeading";
import type { BookingResult } from "@/lib/bookings/types";
import { formatDateTime, formatDayMedium } from "@/lib/dates";

export type WaitlistItem = {
  id: string;
  day: string;
  position: number | null;
  status: "waiting" | "offered";
  offerExpiresAt?: string;
  offerId?: string;
  joinedAt?: string;
  waitingTotal?: number;
  paused?: boolean;
};

export type OfferHistoryItem = {
  id: string;
  day: string;
  status: "accepted" | "declined" | "expired" | "revoked";
  offeredAt: string;
  reason?: string | null;
};

const how = [
  { icon: <ListOrdered />, title: "Ti metti in coda", text: "Quando una giornata è completa puoi iscriverti: conta l'ordine di iscrizione." },
  { icon: <MailCheck />, title: "Ricevi una proposta", text: "Se qualcuno annulla, il posto viene proposto al primo in lista con un'email e un link personale." },
  { icon: <Sparkles />, title: "Confermi entro il tempo indicato", text: "Di norma 2 ore. Se non confermi, il posto passa al successivo." },
];

const historyLabel: Record<OfferHistoryItem["status"], { label: string; tone: BadgeTone }> = {
  accepted: { label: "Confermata", tone: "success" },
  declined: { label: "Rinunciata", tone: "neutral" },
  expired: { label: "Scaduta", tone: "warning" },
  revoked: { label: "Annullata", tone: "neutral" },
};

type Handler = (id: string) => Promise<BookingResult> | void;

/** "Le mie liste d'attesa": posizione, proposte da confermare, uscita, storico delle proposte. */
export function StudentWaitlistView({
  base,
  waitlist,
  history = [],
  offerMinutes,
  onLeave,
  onAccept,
  onDecline,
}: {
  base: string;
  waitlist: WaitlistItem[];
  history?: OfferHistoryItem[];
  offerMinutes?: number;
  onLeave: Handler;
  onAccept: Handler;
  onDecline: Handler;
}) {
  const [message, setMessage] = useState<{ tone: "info" | "danger"; text: string } | null>(null);
  const [busy, startTransition] = useTransition();
  const run = (fn: () => Promise<BookingResult> | void, ok: string) => {
    setMessage(null);
    startTransition(async () => {
      const r = await fn();
      if (r) setMessage(r.ok ? { tone: "info", text: ok } : { tone: "danger", text: r.message });
    });
  };
  const sorted = [...waitlist].sort((a, b) => (a.status === "offered" ? -1 : 0) - (b.status === "offered" ? -1 : 0) || a.day.localeCompare(b.day));
  const hours = offerMinutes ? (offerMinutes % 60 === 0 ? `${offerMinutes / 60} ${offerMinutes === 60 ? "ora" : "ore"}` : `${offerMinutes} minuti`) : null;

  return (
    <>
      <PageHeading eyebrow="Liste d'attesa" title="Le mie liste d'attesa">
        Le giornate complete in cui aspetti che si liberi un posto.
      </PageHeading>
      {message && <Notice tone={message.tone} className="mb-4">{message.text}</Notice>}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-6">
          {sorted.length ? (
            <ul className="space-y-3">
              {sorted.map((w) => (
                <WaitlistCard
                  key={w.id}
                  {...w}
                  busy={busy}
                  onLeave={() => run(() => onLeave(w.id), "Sei uscito dalla lista d'attesa.")}
                  onAccept={() => run(() => onAccept(w.offerId ?? w.id), "Posto confermato! Lo trovi tra le tue prenotazioni.")}
                  onDecline={() => run(() => onDecline(w.offerId ?? w.id), "Hai rinunciato: il posto è stato proposto allo studente successivo.")}
                />
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Hourglass />} title="Non sei in nessuna lista" action={<ButtonLink href={`${base}/calendario`} variant="secondary">Apri il calendario</ButtonLink>}>
              Quando una giornata è completa, dal calendario puoi iscriverti alla lista d&apos;attesa.
            </EmptyState>
          )}
          {history.length > 0 && (
            <section aria-labelledby="offers-history">
              <h2 id="offers-history" className="mb-3 font-display text-lg font-semibold text-ink">Proposte ricevute</h2>
              <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface shadow-soft">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 p-4">
                    <CalendarClock className="size-5 shrink-0 text-wood" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink first-letter:uppercase">{formatDayMedium(h.day)}</p>
                      <p className="text-xs text-muted">Proposta del {formatDateTime(h.offeredAt)}{h.reason ? ` · ${h.reason}` : ""}</p>
                    </div>
                    <Badge tone={historyLabel[h.status].tone}>{historyLabel[h.status].label}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <aside className="rounded-[var(--radius-card)] border border-line bg-wood-soft/60 p-5">
          <h2 className="mb-4 font-display text-lg font-semibold text-wood">Come funziona</h2>
          <ol className="space-y-4">
            {how.map((h, i) => (
              <li key={h.title} className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-wood shadow-soft [&_svg]:size-4">{h.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-ink">{i + 1}. {i === 2 && hours ? `Confermi entro ${hours}` : h.title}</p>
                  <p className="text-sm text-muted">{h.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-muted">Nelle 24 ore prima dell&apos;apertura non partono nuove proposte: i posti liberi tornano prenotabili da tutti.</p>
        </aside>
      </div>
    </>
  );
}
