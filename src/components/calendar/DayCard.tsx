import { CalendarCheck2, CalendarOff, Clock3, Hourglass, Info, ListPlus, Lock, Undo2 } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SeatMeter } from "@/components/ui/SeatMeter";
import { cancellationDeadline, formatDeadline, romeToUtc } from "@/lib/booking-rules";
import { availabilityLevel, STATUS_LABEL, type AvailabilityLevel, type CalendarDay } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { formatDayMedium, formatTime } from "@/lib/dates";

export type StudentDayState = "none" | "booked" | "waitlisted" | "offered";

export const FULL_MESSAGE = (capacity: number) =>
  `È stato raggiunto il numero massimo di ${capacity} prenotazioni. Puoi iscriverti alla lista d'attesa.`;

const levelTone: Record<AvailabilityLevel, BadgeTone> = {
  available: "success",
  limited: "warning",
  full: "danger",
  closed: "neutral",
  past: "neutral",
};

/**
 * Scheda della singola giornata: data, giorno, prenotazioni, posti liberi,
 * stato e azione principale. I controlli definitivi sono sul server:
 * qui servono solo a mostrare lo stato giusto e disattivare i pulsanti.
 */
export function DayCard({
  day,
  today,
  now,
  state,
  waitlistPosition,
  offerExpiresAt,
  cancelDeadline,
  onBook,
  onCancel,
  onJoinWaitlist,
  onLeaveWaitlist,
  onAcceptOffer,
  onDeclineOffer,
  waitlistAvailable = true,
  busy = false,
  compact = false,
}: {
  day: CalendarDay;
  today: string;
  now: Date;
  state: StudentDayState;
  waitlistPosition?: number | null;
  offerExpiresAt?: string;
  /** scadenza per annullare calcolata dal server; se assente si calcola qui */
  cancelDeadline?: Date;
  onBook?: () => void;
  onCancel?: () => void;
  onJoinWaitlist?: () => void;
  onLeaveWaitlist?: () => void;
  onAcceptOffer?: () => void;
  onDeclineOffer?: () => void;
  /** iscrizioni alla lista possibili (se false si spiega il motivo) */
  waitlistAvailable?: boolean;
  /** operazione in corso: pulsanti disattivati */
  busy?: boolean;
  compact?: boolean;
}) {
  const isPast = day.day < today;
  const level = availabilityLevel({ booked: day.booked, capacity: day.capacity, isOpen: day.isOpen, isPast });
  const free = Math.max(day.capacity - day.booked, 0);
  const deadline = cancelDeadline ?? cancellationDeadline(day.day, day.opensAt);
  const cancellable = now.getTime() < deadline.getTime();
  const bookingClosed = now.getTime() >= romeToUtc(day.day, formatTime(day.opensAt)).getTime();

  let action: ReactNode = null;
  if (state === "booked") {
    action = cancellable ? (
      <Button variant="danger" className="w-full" onClick={onCancel}>
        <Undo2 /> Annulla prenotazione
      </Button>
    ) : (
      <div className="space-y-2">
        <Button variant="secondary" className="w-full" disabled aria-describedby={`deadline-${day.day}`}>
          <Lock /> Annullamento non più possibile
        </Button>
        <p id={`deadline-${day.day}`} className="text-center text-xs text-muted">
          Il termine era {formatDeadline(deadline)} (24 ore prima dell&apos;apertura).
        </p>
      </div>
    );
  } else if (state === "offered") {
    action = (
      <div className="space-y-3">
        <p role="status" className="rounded-lg bg-gold-soft p-3 text-sm font-medium text-wood">
          Si è liberato un posto per te{offerExpiresAt ? `: conferma entro ${formatDeadline(new Date(offerExpiresAt))}` : ""}.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onDeclineOffer} disabled={busy}>Rinuncia</Button>
          <Button onClick={onAcceptOffer} disabled={busy}><CalendarCheck2 /> Conferma il posto</Button>
        </div>
      </div>
    );
  } else if (state === "waitlisted") {
    action = (
      <div className="space-y-3">
        <p className="rounded-lg bg-blue-50 p-3 text-sm text-ink">
          Sei <strong>{waitlistPosition}°</strong> in lista d&apos;attesa. Se si libera un posto ti arriva un&apos;email con il link per confermarlo.
        </p>
        <Button variant="secondary" className="w-full" onClick={onLeaveWaitlist} disabled={busy}>
          Esci dalla lista d&apos;attesa
        </Button>
      </div>
    );
  } else if (bookingClosed && !isPast && day.isOpen) {
    action = <p className="text-center text-sm text-muted">Le prenotazioni per oggi sono chiuse: l&apos;aula è già aperta.</p>;
  } else if (level === "available" || level === "limited") {
    action = (
      <Button size="lg" className="w-full" onClick={onBook} disabled={busy}>
        <CalendarCheck2 /> Prenota il posto
      </Button>
    );
  } else if (level === "full") {
    action = (
      <div className="space-y-3">
        <p role="status" className="rounded-lg bg-danger-soft p-3 text-sm font-medium text-danger">
          {FULL_MESSAGE(day.capacity)}
        </p>
        {waitlistAvailable ? (
          <Button variant="gold" size="lg" className="w-full uppercase" onClick={onJoinWaitlist} disabled={busy}>
            <ListPlus /> Iscriviti alla lista d&apos;attesa
          </Button>
        ) : (
          <p className="text-center text-xs text-muted">
            Iscrizioni alla lista d&apos;attesa chiuse: mancano meno di 24 ore all&apos;apertura o la lista è sospesa dai docenti.
          </p>
        )}
        {day.waiting ? <p className="text-center text-xs text-muted">Studenti già in lista: {day.waiting}</p> : null}
      </div>
    );
  }

  return (
    <article className={cn("rounded-[var(--radius-card)] border border-line bg-surface shadow-soft", compact ? "p-4" : "p-5 sm:p-6")}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-wood">Giornata</p>
          <h3 className="font-display text-xl font-semibold text-ink first-letter:uppercase">{formatDayMedium(day.day)}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            <Clock3 className="size-4" /> {formatTime(day.opensAt)} – {formatTime(day.closesAt)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Badge tone={levelTone[level]}>{STATUS_LABEL[level]}</Badge>
          <PersonalBadge state={state} position={waitlistPosition} />
        </div>
      </header>

      {level === "closed" ? (
        <div className="flex gap-3 rounded-xl bg-ink/[0.04] p-4 text-sm">
          <CalendarOff className="mt-0.5 size-5 shrink-0 text-muted" />
          <div>
            <p className="font-semibold text-ink">Aula studio chiusa</p>
            <p className="text-muted">{day.closureReason}</p>
          </div>
        </div>
      ) : (
        <>
          <dl className="mb-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-paper p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">Prenotazioni</dt>
              <dd className="font-display text-2xl font-semibold text-ink tabular">
                {day.booked}
                <span className="text-sm font-normal text-muted">/{day.capacity}</span>
              </dd>
            </div>
            <div className={cn("rounded-xl p-3", level === "limited" ? "bg-warn-soft ring-1 ring-warn/40" : level === "full" ? "bg-danger-soft" : "bg-paper")}>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">Posti disponibili</dt>
              <dd className={cn("font-display text-2xl font-semibold tabular", level === "limited" ? "text-warn" : level === "full" ? "text-danger" : "text-ink")}>
                {isPast ? "—" : free}
              </dd>
            </div>
          </dl>
          <SeatMeter booked={day.booked} capacity={day.capacity} isOpen={day.isOpen} isPast={isPast} showLabel={false} />
          {day.held ? (
            <p className="mt-2 text-xs text-muted">
              {day.held === 1 ? "1 posto è stato proposto" : `${day.held} posti sono stati proposti`} a chi è in lista d&apos;attesa, in attesa di conferma.
            </p>
          ) : null}
          {level === "limited" && (
            <p className="mt-2 text-sm font-semibold text-warn">
              {free === 1 ? "Ultimo posto disponibile!" : `Solo ${free} posti disponibili!`}
            </p>
          )}
        </>
      )}

      {day.note && (
        <p className="mt-4 flex gap-2 rounded-lg bg-gold-soft/60 p-3 text-[13px] text-wood">
          <Info className="mt-0.5 size-4 shrink-0" /> {day.note}
        </p>
      )}

      {state === "booked" && cancellable && (
        <p className="mt-4 text-xs text-muted">Puoi annullare entro {formatDeadline(deadline)}.</p>
      )}

      {action && <div className="mt-5">{action}</div>}
    </article>
  );
}

function PersonalBadge({ state, position }: { state: StudentDayState; position?: number | null }) {
  if (state === "booked") return <Badge tone="gold" icon={<CalendarCheck2 />}>Prenotata da te</Badge>;
  if (state === "offered") return <Badge tone="blue">Posto proposto</Badge>;
  if (state === "waitlisted") return <Badge tone="blue" icon={<Hourglass />}>In attesa{position ? ` · ${position}°` : ""}</Badge>;
  return null;
}
