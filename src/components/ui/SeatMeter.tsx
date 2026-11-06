import { availabilityLevel, type AvailabilityLevel } from "@/lib/calendar";
import { cn } from "@/lib/cn";

const barTone: Record<AvailabilityLevel, string> = {
  available: "bg-ok",
  limited: "bg-warn",
  full: "bg-danger",
  closed: "bg-muted/40",
  past: "bg-muted/40",
};


/**
 * Indicatore dei posti: barra di riempimento + testo.
 * Lo stato è comunicato anche a parole, non solo con il colore.
 */
export function SeatMeter({
  booked,
  capacity,
  isOpen = true,
  isPast = false,
  size = "md",
  showLabel = true,
}: {
  booked: number;
  capacity: number;
  isOpen?: boolean;
  isPast?: boolean;
  size?: "sm" | "md";
  showLabel?: boolean;
}) {
  const level = availabilityLevel({ booked, capacity, isOpen, isPast });
  const free = Math.max(capacity - booked, 0);
  const pct = capacity > 0 ? Math.min((booked / capacity) * 100, 100) : 0;

  return (
    <div className="w-full">
      {showLabel && (
        <div className={cn("mb-1.5 flex items-baseline justify-between gap-2", size === "sm" ? "text-xs" : "text-sm")}>
          <span className="font-semibold text-ink">
            {level === "closed" ? "Chiuso" : level === "past" ? "Giornata conclusa" : (
              <>
                <span className="tabular">{free}</span> {free === 1 ? "posto libero" : "posti liberi"}
              </>
            )}
          </span>
          <span className="text-muted tabular">
            {booked}/{capacity}
          </span>
        </div>
      )}
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-valuenow={booked}
        aria-label={`${booked} posti occupati su ${capacity}`}
        className={cn("overflow-hidden rounded-full bg-ink/[0.07]", size === "sm" ? "h-1.5" : "h-2")}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-700 ease-out", barTone[level])}
          style={{ width: `${level === "closed" ? 0 : pct}%` }}
        />
      </div>
    </div>
  );
}
