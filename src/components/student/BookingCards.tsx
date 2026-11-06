import { CalendarCheck2, CalendarX2, CheckCheck, Clock3, Hourglass, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cancellationDeadline, formatDeadline } from "@/lib/booking-rules";
import { CALENDAR } from "@/lib/config";
import { cn } from "@/lib/cn";
import { dayOfMonth, formatDateTime, formatDayMedium, formatTime, formatWeekdayShort } from "@/lib/dates";

function DateTile({ day, tone = "blue" }: { day: string; tone?: "blue" | "gold" | "muted" }) {
  const month = new Intl.DateTimeFormat("it-IT", { month: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
  return (
    <div
      className={cn(
        "flex w-14 shrink-0 flex-col items-center rounded-xl py-2 text-center",
        tone === "blue" && "bg-ink text-white",
        tone === "gold" && "bg-gold-soft text-wood",
        tone === "muted" && "bg-ink/[0.05] text-muted",
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{formatWeekdayShort(day)}</span>
      <span className="font-display text-2xl font-semibold leading-none tabular">{dayOfMonth(day)}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{month}</span>
    </div>
  );
}

/**
 * Una prenotazione: data, orario, data della prenotazione, stato e,
 * quando consentito, il pulsante per annullare (disattivato dopo la scadenza).
 */
export function BookingCard({
  day,
  status,
  createdAt,
  now,
  opensAt = CALENDAR.opensAt,
  closesAt = CALENDAR.closesAt,
  cancelDeadline,
  onCancel,
}: {
  day: string;
  status: "confirmed" | "cancelled" | "attended";
  createdAt: string;
  now: Date;
  opensAt?: string;
  closesAt?: string;
  /** ISO dal database; se assente si calcola con le regole predefinite */
  cancelDeadline?: string;
  onCancel?: () => void;
}) {
  const deadline = cancelDeadline ? new Date(cancelDeadline) : cancellationDeadline(day, formatTime(opensAt));
  const cancellable = status === "confirmed" && now.getTime() < deadline.getTime();
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-soft">
      <DateTile day={day} tone={status === "confirmed" ? "blue" : "muted"} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold first-letter:uppercase text-ink">{formatDayMedium(day)}</p>
        <p className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-sm text-muted">
          <Clock3 className="size-3.5" /> {formatTime(opensAt)}–{formatTime(closesAt)}
        </p>
        <p className="mt-1 text-xs text-muted">Prenotata il {formatDateTime(createdAt)}</p>
        {status === "confirmed" && (
          <p className="text-xs text-muted">
            {cancellable ? <>Annullabile entro {formatDeadline(deadline)}</> : <>Non più annullabile (termine {formatDeadline(deadline)})</>}
          </p>
        )}
      </div>
      <div className="flex w-full items-center justify-between gap-2 border-t border-line pt-3 sm:w-auto sm:flex-col sm:items-end sm:border-0 sm:pt-0">
        {status === "confirmed" && <Badge tone="gold" icon={<CalendarCheck2 />}>Confermata</Badge>}
        {status === "attended" && <Badge tone="success" icon={<CheckCheck />}>Conclusa</Badge>}
        {status === "cancelled" && <Badge icon={<CalendarX2 />}>Annullata</Badge>}
        {status === "confirmed" && onCancel && (
          <Button
            variant="danger"
            size="sm"
            onClick={onCancel}
            disabled={!cancellable}
            title={cancellable ? undefined : "Mancano meno di 24 ore all'apertura"}
            aria-label={`Annulla la prenotazione di ${formatDayMedium(day)}`}
          >
            Annulla
          </Button>
        )}
      </div>
    </li>
  );
}

/** Iscrizione alla lista d'attesa: posizione, eventuale proposta con conferma o rinuncia, uscita. */
export function WaitlistCard({
  day,
  position,
  status,
  offerExpiresAt,
  joinedAt,
  waitingTotal,
  paused = false,
  busy = false,
  onLeave,
  onAccept,
  onDecline,
}: {
  day: string;
  position: number | null;
  status: "waiting" | "offered";
  offerExpiresAt?: string;
  joinedAt?: string;
  waitingTotal?: number;
  paused?: boolean;
  busy?: boolean;
  onLeave?: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
}) {
  const offered = status === "offered";
  return (
    <li
      className={cn(
        "rounded-[var(--radius-card)] border bg-surface p-4 shadow-soft",
        offered ? "border-gold ring-4 ring-gold-soft" : "border-line",
      )}
    >
      <div className="flex items-center gap-4">
        <DateTile day={day} tone={offered ? "gold" : "muted"} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold first-letter:uppercase text-ink">{formatDayMedium(day)}</p>
          {offered ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-wood">
              <Sparkles className="size-4" /> Si è liberato un posto per te
            </p>
          ) : (
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
              <Hourglass className="size-3.5" /> Sei {position}° in lista{waitingTotal ? ` su ${waitingTotal}` : ""}
            </p>
          )}
          {joinedAt && <p className="mt-0.5 text-xs text-muted">Iscritto il {formatDateTime(joinedAt)}</p>}
          {paused && !offered && <p className="mt-0.5 text-xs font-medium text-warn">Lista sospesa dai docenti</p>}
        </div>
        {!offered && (
          <div className="hidden shrink-0 text-right sm:block">
            <p className="font-display text-3xl font-semibold text-ink tabular">{position}°</p>
            <p className="text-[11px] uppercase tracking-wider text-muted">posizione</p>
          </div>
        )}
      </div>
      {offered ? (
        <div className="mt-4 border-t border-line pt-4">
          {offerExpiresAt && (
            <p className="mb-3 text-xs text-muted">Conferma entro {formatDateTime(offerExpiresAt)}, poi il posto passa al successivo.</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={onDecline} disabled={busy}>Rinuncia</Button>
            <Button onClick={onAccept} disabled={busy}><CalendarCheck2 /> Conferma il posto</Button>
          </div>
        </div>
      ) : (
        onLeave && (
          <div className="mt-3 flex justify-end">
            <Button variant="ghost" size="sm" onClick={onLeave} disabled={busy}>Esci dalla lista</Button>
          </div>
        )
      )}
    </li>
  );
}

export { DateTile };
