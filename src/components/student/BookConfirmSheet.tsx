"use client";

import { CalendarCheck2, CircleCheck, Clock3, GraduationCap, ListPlus, LoaderCircle, TriangleAlert, Undo2, UserRound } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { cancellationDeadline, formatDeadline } from "@/lib/booking-rules";
import type { BookingResult } from "@/lib/bookings/types";
import type { CalendarDay } from "@/lib/calendar";
import { formatDayMedium, formatTime } from "@/lib/dates";

export type ProfileSummary = { name: string; className?: string | null };

type Phase = { kind: "confirm" } | { kind: "pending" } | { kind: "done" } | { kind: "error"; result: Extract<BookingResult, { ok: false }> };

/**
 * Conferma della prenotazione: riepilogo con i dati del profilo (non si
 * chiedono di nuovo), invio, e conferma a schermo con l'esito del server.
 */
export function BookConfirmSheet({
  day,
  profile,
  onClose,
  onConfirm,
}: {
  day: CalendarDay | null;
  profile?: ProfileSummary;
  onClose: () => void;
  onConfirm: (day: CalendarDay) => Promise<BookingResult>;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "confirm" });
  const [shown, setShown] = useState<CalendarDay | null>(day);
  // nuova giornata aperta: riparte dalla conferma
  if (day && day !== shown) {
    setShown(day);
    setPhase({ kind: "confirm" });
  }
  const close = () => {
    setPhase({ kind: "confirm" });
    onClose();
  };
  const current = day ?? shown;

  async function confirm() {
    if (!current) return;
    setPhase({ kind: "pending" });
    const result = await onConfirm(current);
    setPhase(result.ok ? { kind: "done" } : { kind: "error", result });
  }

  const title =
    phase.kind === "done" ? "Prenotazione confermata" : phase.kind === "error" ? "Prenotazione non riuscita" : "Confermi la prenotazione?";

  return (
    <Sheet
      open={Boolean(day)}
      onClose={close}
      title={title}
      footer={
        phase.kind === "done" ? (
          <Button size="lg" data-autofocus onClick={close}>
            <CircleCheck /> Fatto
          </Button>
        ) : phase.kind === "error" ? (
          <>
            {phase.result.code === "capacity_reached" && (
              <Button variant="gold" size="lg" disabled title="Disponibile dalla Fase 7">
                <ListPlus /> Lista d&apos;attesa
              </Button>
            )}
            <Button variant="secondary" size="lg" data-autofocus onClick={close}>Chiudi</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" size="lg" onClick={close} disabled={phase.kind === "pending"}>Indietro</Button>
            <Button size="lg" data-autofocus onClick={confirm} disabled={phase.kind === "pending"}>
              {phase.kind === "pending" ? <LoaderCircle className="animate-spin" /> : <CalendarCheck2 />}
              {phase.kind === "pending" ? "Prenotazione…" : "Conferma"}
            </Button>
          </>
        )
      }
    >
      {current && (
        <div className="space-y-3">
          {phase.kind === "done" && (
            <p role="status" className="flex items-start gap-2 rounded-xl bg-ok-soft p-3 text-sm font-medium text-ok">
              <CircleCheck className="mt-0.5 size-4 shrink-0" /> Il tuo posto è riservato. Lo trovi nell&apos;area personale.
            </p>
          )}
          {phase.kind === "error" && (
            <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-sm font-medium text-danger">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {phase.result.message}
            </p>
          )}
          <div className="rounded-xl border border-line bg-paper p-4">
            <p className="font-display text-lg font-semibold text-ink first-letter:uppercase">{formatDayMedium(current.day)}</p>
            <p className="mt-1 flex items-center gap-1.5"><Clock3 className="size-4" /> {formatTime(current.opensAt)} – {formatTime(current.closesAt)} · biblioteca storica</p>
            {phase.kind !== "done" && phase.kind !== "error" && <p className="mt-1">{current.capacity - current.booked} posti ancora liberi</p>}
          </div>
          {profile && (
            <dl className="grid grid-cols-2 gap-2 text-[13px]">
              <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-ink">
                <UserRound className="size-4 shrink-0" /><dt className="sr-only">Studente</dt><dd className="truncate">{profile.name}</dd>
              </div>
              {profile.className && (
                <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-ink">
                  <GraduationCap className="size-4 shrink-0" /><dt className="sr-only">Classe</dt><dd>Classe {profile.className}</dd>
                </div>
              )}
            </dl>
          )}
          {phase.kind !== "error" && (
            <p className="flex items-start gap-2 text-[13px]">
              <Undo2 className="mt-0.5 size-4 shrink-0 text-wood" />
              Puoi annullare fino a {formatDeadline(cancellationDeadline(current.day, formatTime(current.opensAt)))}.
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}

/** Conferma dell'annullamento. */
export function CancelConfirmSheet({
  day,
  onClose,
  onConfirm,
}: {
  day: string | null;
  onClose: () => void;
  onConfirm: () => Promise<BookingResult>;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "confirm" });
  const close = () => {
    setPhase({ kind: "confirm" });
    onClose();
  };
  async function confirm() {
    setPhase({ kind: "pending" });
    const result = await onConfirm();
    setPhase(result.ok ? { kind: "done" } : { kind: "error", result });
  }
  return (
    <Sheet
      open={Boolean(day)}
      onClose={close}
      title={phase.kind === "done" ? "Prenotazione annullata" : phase.kind === "error" ? "Annullamento non riuscito" : "Annullare la prenotazione?"}
      footer={
        phase.kind === "done" || phase.kind === "error" ? (
          <Button size="lg" data-autofocus onClick={close}>Chiudi</Button>
        ) : (
          <>
            <Button variant="secondary" size="lg" onClick={close} disabled={phase.kind === "pending"}>No, mantieni</Button>
            <Button variant="danger" size="lg" data-autofocus onClick={confirm} disabled={phase.kind === "pending"}>
              {phase.kind === "pending" ? <LoaderCircle className="animate-spin" /> : <Undo2 />} Sì, annulla
            </Button>
          </>
        )
      }
    >
      {day && (
        <div className="space-y-3">
          {phase.kind === "done" && <p role="status" className="rounded-xl bg-ok-soft p-3 text-sm font-medium text-ok">Il posto è di nuovo disponibile per gli altri studenti.</p>}
          {phase.kind === "error" && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-medium text-danger">{phase.result.message}</p>}
          <p className="font-display text-lg font-semibold text-ink first-letter:uppercase">{formatDayMedium(day)}</p>
        </div>
      )}
    </Sheet>
  );
}
