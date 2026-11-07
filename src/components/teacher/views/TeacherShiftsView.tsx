"use client";

import { CalendarDays, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { ShiftPanel, type ShiftActions } from "@/components/teacher/ShiftPanel";
import { Badge } from "@/components/ui/Badge";
import { Card, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeading } from "@/components/ui/PageHeading";
import { StatCard } from "@/components/ui/StatCard";
import type { CalendarDay } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { formatDayMedium } from "@/lib/dates";
import type { ShiftMap, ShiftViewer } from "@/lib/teacher/types";

const monthLabel = (m: string) =>
  new Intl.DateTimeFormat("it-IT", { month: "long", timeZone: "UTC" }).format(new Date(`${m}-15T12:00:00Z`));

/**
 * Turni di sorveglianza: per ogni giornata aperta, chi è il docente di turno.
 * Ogni docente prende o lascia il proprio turno; l'amministratore assegna
 * il turno a qualsiasi docente scrivendone nome e cognome.
 */
export function TeacherShiftsView({
  today,
  days,
  shifts,
  viewer,
  actions,
}: {
  today: string;
  days: CalendarDay[];
  shifts: ShiftMap;
  viewer: ShiftViewer;
  actions?: ShiftActions;
}) {
  const open = days.filter((d) => d.isOpen && d.day >= today);
  const months = [...new Set(open.map((d) => d.day.slice(0, 7)))];
  const [month, setMonth] = useState(months[0] ?? "");
  const [onlyUncovered, setOnlyUncovered] = useState(false);
  const next10 = open.slice(0, 10);
  const uncovered10 = next10.filter((d) => !(shifts[d.day]?.length)).length;
  const mine = open.filter((d) => shifts[d.day]?.some((s) => s.mine));
  const visible = open.filter((d) => d.day.startsWith(month) && (!onlyUncovered || !(shifts[d.day]?.length)));

  return (
    <>
      <PageHeading eyebrow="Turni di sorveglianza" title="Docenti di turno">
        Il docente di turno è il responsabile dell&apos;aula studio in quel pomeriggio.
        {viewer.isAdmin
          ? " Come amministratore puoi assegnare il turno a qualsiasi docente scrivendone nome e cognome."
          : " Prendi i turni in cui sei disponibile: li vedono tutti i docenti."}
      </PageHeading>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="I miei turni" value={mine.length} icon={<ShieldCheck />} hint="da oggi in poi" />
        <StatCard
          label="Scoperte"
          value={uncovered10}
          icon={<ShieldAlert />}
          hint="tra le prossime 10 giornate"
          className={uncovered10 ? "ring-1 ring-warn/40" : undefined}
        />
        <StatCard label="Giornate aperte" value={open.length} icon={<CalendarDays />} hint="fino a fine stagione" className="col-span-2 lg:col-span-1" />
      </div>

      {mine.length > 0 && (
        <Card className="mt-6">
          <CardTitle icon={<ShieldCheck />} eyebrow="Promemoria">I miei prossimi turni</CardTitle>
          <ul className="flex flex-wrap gap-2" data-testid="my-shifts">
            {mine.slice(0, 12).map((d) => (
              <li key={d.day}>
                <Badge tone="blue">{formatDayMedium(d.day)} · {d.opensAt}–{d.closesAt}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {months.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMonth(m)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-semibold capitalize transition",
              m === month ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-soft hover:border-ink/40",
            )}
            aria-pressed={m === month}
          >
            {monthLabel(m)}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={onlyUncovered} onChange={(e) => setOnlyUncovered(e.target.checked)} className="size-4 accent-[var(--ink)]" />
          Solo giornate senza docente di turno
        </label>
      </div>

      {visible.length ? (
        <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="shift-days">
          {visible.map((d) => {
            const list = shifts[d.day] ?? [];
            return (
              <li key={d.day} className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-soft" data-testid="shift-day" data-day={d.day}>
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink first-letter:uppercase">{formatDayMedium(d.day)}</p>
                    <p className="text-xs text-muted">{d.opensAt}–{d.closesAt} · {d.booked}/{d.capacity} prenotati</p>
                  </div>
                  {list.length ? <Badge tone="success">Coperta</Badge> : <Badge tone="warning">Scoperta</Badge>}
                </div>
                {d.id && <ShiftPanel compact schoolDayId={d.id} shifts={list} viewer={viewer} isPast={false} actions={actions} />}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-4">
          <EmptyState icon={<ShieldCheck />} title={onlyUncovered ? "Tutte coperte" : "Nessuna giornata aperta"}>
            {onlyUncovered ? "In questo mese ogni giornata aperta ha un docente di turno." : "Non ci sono giornate aperte in questo mese."}
          </EmptyState>
        </div>
      )}
    </>
  );
}
