"use client";

import { AlarmClock, CirclePause, CirclePlay, Clock3, Hourglass, LoaderCircle, Save, Sparkles, TimerOff, UserMinus } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import type { TeacherActionResult } from "@/app/docenti/(area)/waitlist-actions";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Select } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { PageHeading } from "@/components/ui/PageHeading";
import { StatCard } from "@/components/ui/StatCard";
import { formatDateTime, formatDayMedium } from "@/lib/dates";
import type { OfferRowView, WaitlistDashboardData, WaitlistDayView, WaitlistEntryView } from "@/lib/waitlist/types";

type Actions = {
  setOfferMinutes: (prev: TeacherActionResult, fd: FormData) => Promise<TeacherActionResult>;
  setPaused: (dayId: string, paused: boolean) => Promise<TeacherActionResult>;
  removeEntry: (entryId: string) => Promise<TeacherActionResult>;
};

const entryStatus = (e: WaitlistEntryView): { label: string; tone: BadgeTone } => {
  if (e.status === "waiting") return { label: "In attesa", tone: "blue" };
  if (e.status === "offered") return { label: "Proposta inviata", tone: "gold" };
  if (e.status === "assigned") return { label: e.offer?.status === "accepted" ? "Posto confermato" : "Prenotato", tone: "success" };
  if (e.status === "expired") return { label: e.offer?.status === "expired" ? "Proposta scaduta" : "Chiusa", tone: "warning" };
  return { label: e.endReason === "Rimosso dal docente" ? "Rimosso" : "Uscito", tone: "neutral" };
};

const minutesLabel = (m: number) => (m % 60 === 0 ? `${m / 60} ${m === 60 ? "ora" : "ore"}` : `${Math.floor(m / 60)} h ${m % 60} min`);

/** Dashboard docenti della lista d'attesa. Riceve dati e azioni come props. */
export function TeacherWaitlistView({ data, actions }: { data: WaitlistDashboardData; actions: Actions }) {
  const [state, submitMinutes, savingMinutes] = useActionState(actions.setOfferMinutes, { ok: false });
  const [message, setMessage] = useState<{ tone: "info" | "danger"; text: string } | null>(null);
  const [busy, startTransition] = useTransition();
  const run = (fn: () => Promise<TeacherActionResult>, ok: string) => {
    setMessage(null);
    startTransition(async () => {
      const r = await fn();
      setMessage(r.ok ? { tone: "info", text: ok } : { tone: "danger", text: r.message ?? "Operazione non riuscita." });
    });
  };

  return (
    <>
      <PageHeading eyebrow="Lista d'attesa" title="Lista d'attesa automatica">
        I posti liberati vengono proposti in automatico al primo in lista. Qui controlli code, proposte e impostazioni.
      </PageHeading>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="In attesa" value={data.totalWaiting} icon={<Hourglass />} hint="studenti in coda" />
        <StatCard label="Da confermare" value={data.pendingOffers.length} icon={<Sparkles />} hint="proposte aperte" />
        <StatCard label="Scadute" value={data.expiredOffers.length} icon={<TimerOff />} hint="senza conferma" />
        <StatCard label="Tempo" value={minutesLabel(data.offerMinutes)} icon={<AlarmClock />} hint="per confermare" />
      </div>

      {message && <Notice tone={message.tone} className="mt-6">{message.text}</Notice>}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr] xl:items-start">
        <div className="space-y-6">
          {data.days.length === 0 ? (
            <EmptyState icon={<Hourglass />} title="Nessuno in lista d'attesa">
              Gli studenti possono iscriversi quando una giornata raggiunge i posti disponibili.
            </EmptyState>
          ) : (
            data.days.map((d) => (
              <DayQueue
                key={d.id}
                day={d}
                busy={busy}
                onTogglePause={() => run(() => actions.setPaused(d.id, !d.paused), d.paused ? "Lista riattivata: i posti liberi vengono proposti subito." : "Lista sospesa: nessuna nuova iscrizione o proposta.")}
                onRemove={(entry) => run(() => actions.removeEntry(entry.id), `${entry.studentName} è stato rimosso dalla lista.`)}
              />
            ))
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardTitle icon={<AlarmClock />} eyebrow="Impostazioni">Tempo per confermare</CardTitle>
            <form action={submitMinutes} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ore" htmlFor="offer-hours">
                  <Select id="offer-hours" name="hours" defaultValue={String(Math.floor(data.offerMinutes / 60))}>
                    {Array.from({ length: 13 }, (_, h) => <option key={h} value={h}>{h}</option>)}
                  </Select>
                </Field>
                <Field label="Minuti" htmlFor="offer-minutes">
                  <Select id="offer-minutes" name="minutes" defaultValue={String(data.offerMinutes % 60)}>
                    {[0, 15, 30, 45].map((m) => <option key={m} value={m}>{m}</option>)}
                  </Select>
                </Field>
              </div>
              <p className="text-xs text-muted">Da 15 minuti a 12 ore. Vale per le nuove proposte. Nelle {data.cancellationHours} ore prima dell&apos;apertura non partono nuove proposte.</p>
              {state.message && <Notice tone={state.ok ? "info" : "danger"}>{state.message}</Notice>}
              <Button type="submit" disabled={savingMinutes}>
                {savingMinutes ? <LoaderCircle className="animate-spin" /> : <Save />} Salva
              </Button>
            </form>
          </Card>

          <OfferList title="In attesa di conferma" eyebrow="Proposte aperte" icon={<Sparkles />} offers={data.pendingOffers} empty="Nessuna proposta in attesa." pending />
          <OfferList title="Proposte scadute" eyebrow="Senza conferma" icon={<TimerOff />} offers={data.expiredOffers} empty="Nessuna proposta scaduta." />
        </div>
      </div>
    </>
  );
}

function DayQueue({ day, busy, onTogglePause, onRemove }: { day: WaitlistDayView; busy: boolean; onTogglePause: () => void; onRemove: (e: WaitlistEntryView) => void }) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const active = day.entries.filter((e) => e.status === "waiting" || e.status === "offered");
  const past = day.entries.filter((e) => !(e.status === "waiting" || e.status === "offered"));
  return (
    <section aria-label={`Lista d'attesa di ${formatDayMedium(day.day)}`} className="rounded-[var(--radius-card)] border border-line bg-surface shadow-soft">
      <header className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink first-letter:uppercase">{formatDayMedium(day.day)}</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="tabular">{day.confirmed}/{day.capacity} prenotati</span>
            {day.held > 0 && <span>· {day.held} in proposta</span>}
            <span>· {day.waiting} in attesa</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!day.isOpen ? <Badge>Giornata chiusa</Badge> : day.paused ? <Badge tone="warning">Lista sospesa</Badge> : day.waitlistOpen ? <Badge tone="success">Lista attiva</Badge> : <Badge>Oltre le 24 ore</Badge>}
          {day.isOpen && (
            <Button variant="secondary" size="sm" onClick={onTogglePause} disabled={busy}>
              {day.paused ? <><CirclePlay /> Riattiva</> : <><CirclePause /> Sospendi</>}
            </Button>
          )}
        </div>
      </header>
      {active.length > 0 ? (
        <ol className="divide-y divide-line">
          {active.map((e) => {
            const st = entryStatus(e);
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink/[0.06] text-sm font-semibold text-ink tabular">
                  {e.position ?? "★"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">
                    {e.studentName} {e.className && <span className="font-normal text-muted">· {e.className}</span>}
                  </p>
                  <p className="text-xs text-muted">
                    Iscritto il {formatDateTime(e.joinedAt)}
                    {e.status === "offered" && e.offer ? ` · proposta inviata il ${formatDateTime(e.offer.offeredAt)}, scade il ${formatDateTime(e.offer.expiresAt)}` : ""}
                  </p>
                </div>
                <Badge tone={st.tone}>{st.label}</Badge>
                {confirming === e.id ? (
                  <span className="flex gap-1">
                    <Button size="sm" variant="danger" disabled={busy} onClick={() => { setConfirming(null); onRemove(e); }}>Conferma</Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>Annulla</Button>
                  </span>
                ) : (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(e.id)} aria-label={`Rimuovi ${e.studentName} dalla lista`}>
                    <UserMinus /> Rimuovi
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="px-5 py-4 text-sm text-muted">Nessuno in attesa per questa giornata.</p>
      )}
      {past.length > 0 && (
        <details className="border-t border-line px-4 py-3 text-sm sm:px-5">
          <summary className="cursor-pointer font-semibold text-muted">Storico ({past.length})</summary>
          <ul className="mt-2 space-y-1.5">
            {past.map((e) => {
              const st = entryStatus(e);
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-2">
                  <span className="text-ink">{e.studentName}</span>
                  <span className="text-xs text-muted">iscritto il {formatDateTime(e.joinedAt)}</span>
                  <Badge tone={st.tone} className="ml-auto">{st.label}</Badge>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </section>
  );
}

function OfferList({ title, eyebrow, icon, offers, empty, pending = false }: { title: string; eyebrow: string; icon: React.ReactNode; offers: OfferRowView[]; empty: string; pending?: boolean }) {
  return (
    <Card>
      <CardTitle icon={icon} eyebrow={eyebrow}>{title}</CardTitle>
      {offers.length ? (
        <ul className="space-y-2.5">
          {offers.map((o) => (
            <li key={o.id} className="rounded-lg border border-line p-3 text-sm">
              <p className="font-semibold text-ink">
                {o.studentName} {o.className && <span className="font-normal text-muted">· {o.className}</span>}
              </p>
              <p className="text-xs text-muted first-letter:uppercase">{formatDayMedium(o.day)}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                <Clock3 className="size-3.5" />
                {pending ? `Scade il ${formatDateTime(o.expiresAt)}` : `Inviata il ${formatDateTime(o.offeredAt)}, scaduta il ${formatDateTime(o.expiresAt)}`}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{empty}</p>
      )}
    </Card>
  );
}
