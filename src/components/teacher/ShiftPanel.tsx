"use client";

import { ShieldCheck, UserMinus, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import type { ShiftView, ShiftViewer } from "@/lib/teacher/types";

export type ShiftActions = {
  take: (schoolDayId: string) => Promise<{ ok: boolean; message?: string }>;
  assign: (schoolDayId: string, name: string) => Promise<{ ok: boolean; message?: string }>;
  remove: (shiftId: string) => Promise<{ ok: boolean; message?: string }>;
};

/**
 * Docenti di turno di una giornata: chi sorveglia l'aula studio.
 * Ogni docente può prendere o lasciare il proprio turno; un amministratore
 * può assegnarlo a qualsiasi docente scrivendone nome e cognome.
 */
export function ShiftPanel({
  schoolDayId,
  shifts,
  viewer,
  isPast,
  actions,
  compact = false,
}: {
  schoolDayId: string;
  shifts: ShiftView[];
  viewer?: ShiftViewer;
  isPast: boolean;
  actions?: ShiftActions;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mine = shifts.some((s) => s.mine);
  const full = viewer ? shifts.length >= viewer.maxPerDay : false;
  const editable = Boolean(actions && viewer && !isPast);

  const run = async (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) setError(res.message ?? "Operazione non riuscita.");
    return res.ok;
  };

  return (
    <div className={cn("rounded-xl border border-line", compact ? "p-3" : "p-3.5")} data-testid="shift-panel">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-wood">
        <ShieldCheck className="size-3.5" /> Docenti di turno
      </p>
      {shifts.length ? (
        <ul className="mt-2 space-y-1.5">
          {shifts.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 text-sm" data-testid="shift-item">
              <span className="min-w-0 truncate font-medium text-ink">
                {s.name}
                {s.mine && <Badge tone="blue" className="ml-2">Tu</Badge>}
              </span>
              {editable && (s.mine || viewer?.isAdmin) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => actions!.remove(s.id))}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-muted hover:bg-danger/10 hover:text-danger"
                  aria-label={s.mine ? "Lascia il turno" : `Togli il turno di ${s.name}`}
                >
                  {s.mine ? <><UserMinus className="size-3.5" /> Lascia</> : <X className="size-3.5" />}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-sm font-medium text-warn">Nessun docente di turno</p>
      )}

      {editable && !mine && !full && (
        <Button variant="secondary" size="sm" className="mt-3 w-full" disabled={busy} onClick={() => run(() => actions!.take(schoolDayId))}>
          <UserPlus /> Prendo io il turno
        </Button>
      )}
      {editable && viewer?.isAdmin && !full && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => actions!.assign(schoolDayId, name))) setName("");
          }}
        >
          <label htmlFor={`shift-name-${schoolDayId}`} className="sr-only">Nome e cognome del docente di turno</label>
          <TextInput
            id={`shift-name-${schoolDayId}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome e cognome del docente"
            maxLength={120}
            className="h-9 text-sm"
          />
          <Button type="submit" size="sm" disabled={busy || name.trim().length < 3}>Assegna</Button>
        </form>
      )}
      {editable && full && <p className="mt-2 text-xs text-muted">Raggiunto il massimo di {viewer!.maxPerDay} docenti di turno.</p>}
      {error && <p className="mt-2 text-xs font-medium text-danger" role="alert">{error}</p>}
    </div>
  );
}
