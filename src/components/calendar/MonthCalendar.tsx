"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import {
  addMonths,
  availabilityLevel,
  isoDay,
  monthGrid,
  monthKeyOf,
  sameMonth,
  seasonMonths,
  type AvailabilityLevel,
  type CalendarDay,
  type MonthKey,
} from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { dayOfMonth, formatDayMedium, formatMonth, WEEKDAY_LABELS } from "@/lib/dates";

export type DayMarker = "booked" | "waitlisted" | undefined;

const cellTone: Record<AvailabilityLevel, string> = {
  available: "bg-surface hover:border-ink/30",
  limited: "bg-surface hover:border-ink/30",
  full: "bg-surface hover:border-ink/30",
  closed: "bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgb(15_35_80/0.04)_6px_12px)] text-muted",
  past: "bg-transparent text-muted/70",
};

const dotTone: Record<AvailabilityLevel, string> = {
  available: "bg-ok",
  limited: "bg-warn",
  full: "bg-danger",
  closed: "bg-muted/40",
  past: "bg-muted/30",
};

/**
 * Calendario mensile della stagione (solo lunedì–venerdì).
 * variant "student": posti liberi; variant "teacher": percentuale di occupazione.
 */
export function MonthCalendar({
  days,
  today,
  selected,
  onSelect,
  markers,
  variant = "student",
}: {
  days: CalendarDay[];
  today: string;
  selected: string | null;
  onSelect: (day: string) => void;
  markers?: Record<string, DayMarker>;
  variant?: "student" | "teacher";
}) {
  const months = seasonMonths();
  const byDay = useMemo(() => new Map(days.map((d) => [d.day, d])), [days]);
  const seasonFirst = isoDay(months[0].year, months[0].month, 1);
  const initial = monthKeyOf(selected ?? (today > seasonFirst ? today : seasonFirst));
  const [month, setMonth] = useState<MonthKey>(initial);
  const first = months[0];
  const last = months[months.length - 1];
  // nasconde le settimane che non contengono giornate della stagione
  const allWeeks = monthGrid(month);
  const seasonWeeks = allWeeks.filter((w) => w.some((d) => d && byDay.has(d)));
  const weeks = seasonWeeks.length ? seasonWeeks : allWeeks;

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-3 shadow-soft sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2 px-1">
        <h2 className="font-display text-xl font-semibold first-letter:uppercase text-ink" aria-live="polite">
          {formatMonth(month)}
        </h2>
        <div className="flex gap-1">
          <button
            onClick={() => setMonth((m) => addMonths(m, -1))}
            disabled={sameMonth(month, first)}
            aria-label="Mese precedente"
            className="grid size-9 place-items-center rounded-lg border border-line text-ink transition hover:bg-ink/5 disabled:opacity-30"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={() => setMonth((m) => addMonths(m, 1))}
            disabled={sameMonth(month, last)}
            aria-label="Mese successivo"
            className="grid size-9 place-items-center rounded-lg border border-line text-ink transition hover:bg-ink/5 disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div role="grid" aria-label={`Giornate di ${formatMonth(month)}`} className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} role="columnheader" className="pb-1 text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
            {w}
          </div>
        ))}
        {weeks.flat().map((day, i) => {
          if (!day) return <div key={`e${i}`} aria-hidden />;
          const info = byDay.get(day);
          if (!info) {
            return (
              <div key={day} className="flex aspect-square flex-col rounded-lg p-1.5 text-sm text-muted/40 sm:aspect-[1.15] sm:p-2">
                {dayOfMonth(day)}
              </div>
            );
          }
          const level = availabilityLevel({ booked: info.booked, capacity: info.capacity, isOpen: info.isOpen, isPast: day < today });
          const free = info.capacity - info.booked;
          const marker = markers?.[day];
          const isSelected = selected === day;
          const isToday = day === today;
          const pct = Math.round((info.booked / info.capacity) * 100);

          return (
            <button
              key={day}
              role="gridcell"
              aria-selected={isSelected}
              aria-label={`${formatDayMedium(day)}: ${level === "closed" ? `chiusa, ${info.closureReason ?? ""}` : level === "past" ? "conclusa" : level === "full" ? "completa" : `${free} posti liberi`}${marker === "booked" ? ", prenotata da te" : ""}`}
              onClick={() => onSelect(day)}
              className={cn(
                "group relative flex aspect-square flex-col items-start justify-between rounded-lg border p-1.5 text-left transition duration-200 sm:aspect-[1.15] sm:p-2.5",
                cellTone[level],
                isSelected ? "border-ink ring-2 ring-ink/15" : "border-line",
                marker === "booked" && !isSelected && "border-gold bg-gold-soft/50",
              )}
            >
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-full text-[13px] font-semibold tabular sm:size-7 sm:text-sm",
                  isToday ? "bg-ink text-white" : level === "past" ? "" : "text-ink",
                )}
              >
                {dayOfMonth(day)}
              </span>
              {level !== "past" && (
                <span className="flex w-full items-center gap-1">
                  {level === "closed" ? (
                    <span className="truncate text-[10px] font-medium sm:text-[11px]">Chiusa</span>
                  ) : variant === "teacher" ? (
                    <span className="w-full">
                      <span className="mb-0.5 hidden text-[11px] font-semibold text-ink tabular sm:block">{pct}%</span>
                      <span className="block h-1 w-full overflow-hidden rounded-full bg-ink/10">
                        <span className={cn("block h-full rounded-full", dotTone[level])} style={{ width: `${pct}%` }} />
                      </span>
                    </span>
                  ) : (
                    <>
                      <span className={cn("size-2 shrink-0 rounded-full", dotTone[level])} />
                      <span className="hidden truncate text-[11px] font-medium text-muted sm:inline">
                        {level === "full" ? "Completa" : `${free} liberi`}
                      </span>
                    </>
                  )}
                </span>
              )}
              {marker && (
                <span
                  className={cn(
                    "absolute right-1 top-1 size-2 rounded-full ring-2 ring-surface sm:right-2 sm:top-2 sm:size-2.5",
                    marker === "booked" ? "bg-gold" : "bg-ink-soft",
                  )}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>

      <Legend variant={variant} />
    </div>
  );
}

function Legend({ variant }: { variant: "student" | "teacher" }) {
  const items =
    variant === "student"
      ? [
          ["bg-ok", "Disponibile"],
          ["bg-warn", "Quasi completa (≤ 5 posti)"],
          ["bg-danger", "Completa"],
          ["bg-gold", "Prenotata da te"],
        ]
      : [
          ["bg-ok", "Disponibile"],
          ["bg-warn", "Quasi completa (≤ 5 posti)"],
          ["bg-danger", "Completa"],
          ["bg-muted/40", "Chiusa"],
        ];
  return (
    <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line px-1 pt-3 text-xs text-muted">
      {items.map(([c, l]) => (
        <li key={l} className="flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", c)} /> {l}
        </li>
      ))}
    </ul>
  );
}
