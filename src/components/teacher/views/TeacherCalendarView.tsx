"use client";

import {
  CalendarCheck2,
  CalendarX2,
  Hourglass,
  Mail,
  Megaphone,
  Save,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { MonthCalendar } from "@/components/calendar/MonthCalendar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, TextArea, TextInput, Toggle } from "@/components/ui/Field";
import { PageHeading } from "@/components/ui/PageHeading";
import { SeatMeter } from "@/components/ui/SeatMeter";
import { Sheet } from "@/components/ui/Sheet";
import { Toast } from "@/components/ui/Toast";
import type { CalendarDay } from "@/lib/calendar";
import { formatDayLong, formatDayMedium } from "@/lib/dates";
import { cn } from "@/lib/cn";

export type ClosureNotice = {
  notice: "default" | "custom" | "none";
  subject?: string;
  message?: string;
};
export type SaveDayResult = {
  ok: boolean;
  message?: string;
  data?: Record<string, number | boolean>;
};

/**
 * Calendario gestionale: vista mensile, iscritti e posti per giornata,
 * apertura/chiusura/riapertura, orario e capienza della singola giornata.
 * La chiusura di una giornata con iscritti chiede conferma e permette di
 * scegliere la comunicazione da inviare.
 */
export function TeacherCalendarView({
  base,
  today,
  days: initialDays,
  onSave,
  aside,
}: {
  base: string;
  today: string;
  days: CalendarDay[];
  /** salvataggio reale; senza, la modifica resta solo nell'anteprima */
  onSave?: (day: CalendarDay, notice: ClosureNotice) => Promise<SaveDayResult>;
  aside?: React.ReactNode;
}) {
  const [days, setDays] = useState(initialDays);
  const [selected, setSelected] = useState<string>(
    initialDays.find((d) => d.day >= today)?.day ?? initialDays[0].day,
  );
  const day = days.find((d) => d.day === selected)!;
  const [toast, setToast] = useState<{ title: string; body: string } | null>(
    null,
  );
  // i dati aggiornati dal server sostituiscono la copia locale
  const [source, setSource] = useState(initialDays);
  if (source !== initialDays) {
    setSource(initialDays);
    setDays(initialDays);
  }

  async function save(
    next: CalendarDay,
    notice: ClosureNotice,
  ): Promise<boolean> {
    const result = onSave ? await onSave(next, notice) : null;
    if (result && !result.ok) {
      setToast({
        title: "Modifica non salvata",
        body: result.message ?? "Riprova.",
      });
      setTimeout(() => setToast(null), 5000);
      return false;
    }
    setDays((ds) => ds.map((d) => (d.day === next.day ? next : d)));
    const wasOpen = day.isOpen;
    const notified = Number(result?.data?.notified ?? 0);
    const body = !result
      ? "Anteprima: la modifica non è stata salvata nel database."
      : wasOpen && !next.isOpen
        ? notice.notice === "none"
          ? "Prenotazioni bloccate. Nessuna email inviata."
          : `Prenotazioni bloccate. ${notified} ${notified === 1 ? "studente avvisato" : "studenti avvisati"} per email.`
        : !wasOpen && next.isOpen
          ? "La giornata è di nuovo prenotabile."
          : "Le modifiche sono attive.";
    setToast({
      title:
        wasOpen && !next.isOpen
          ? "Giornata chiusa"
          : !wasOpen && next.isOpen
            ? "Giornata riaperta"
            : "Giornata aggiornata",
      body,
    });
    setTimeout(() => setToast(null), 5000);
    return true;
  }

  return (
    <>
      <PageHeading eyebrow="Calendario gestionale" title="Giornate e aperture">
        Seleziona una giornata per vederne gli iscritti, chiuderla o riaprirla,
        cambiarne orario e capienza.
      </PageHeading>
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr] xl:items-start">
        <div className="space-y-6">
          <MonthCalendar
            days={days}
            today={today}
            selected={selected}
            onSelect={setSelected}
            variant="teacher"
          />
          {aside}
        </div>
        <DayEditor
          key={`${day.day}-${day.isOpen}-${day.opensAt}-${day.closesAt}-${day.capacity}`}
          base={base}
          today={today}
          day={day}
          onSave={save}
        />
      </div>
      {toast && (
        <Toast
          title={toast.title}
          body={toast.body}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}

function Mini({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl border border-line px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted [&_svg]:size-3.5">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 font-display text-xl font-semibold text-ink tabular">
        {value}
      </p>
    </div>
  );
}

function DayEditor({
  base,
  today,
  day,
  onSave,
}: {
  base: string;
  today: string;
  day: CalendarDay;
  onSave: (d: CalendarDay, n: ClosureNotice) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(day);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const isPast = day.day < today;
  const confirmed = day.confirmed ?? day.booked;
  const held = day.held ?? 0;
  const waiting = day.waiting ?? 0;
  const free = Math.max(0, day.capacity - day.booked);
  const dirty = JSON.stringify(draft) !== JSON.stringify(day);
  const closing = day.isOpen && !draft.isOpen;
  const capacityError =
    draft.capacity < day.booked
      ? `Non può essere inferiore ai ${day.booked} posti già prenotati o proposti.`
      : null;
  const hoursError =
    draft.closesAt <= draft.opensAt
      ? "L'orario di chiusura deve essere successivo a quello di apertura."
      : null;

  const run = async (next: CalendarDay, notice: ClosureNotice) => {
    setSaving(true);
    const ok = await onSave(next, notice);
    setSaving(false);
    if (ok) setConfirm(false);
  };
  const submit = () => {
    if (closing && confirmed + held + waiting > 0) setConfirm(true);
    else void run(draft, { notice: "default" });
  };

  return (
    <section
      aria-label="Modifica giornata"
      className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-soft sm:p-6 xl:sticky xl:top-8"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-wood">
            Giornata selezionata
          </p>
          <h2 className="font-display text-xl font-semibold text-ink first-letter:uppercase">
            {formatDayMedium(day.day)}
          </h2>
        </div>
        {isPast ? (
          <Badge>Conclusa</Badge>
        ) : day.isOpen ? (
          <Badge tone="success">Aperta</Badge>
        ) : (
          <Badge tone="danger">Chiusa</Badge>
        )}
      </div>

      {day.isOpen ? (
        <>
          <SeatMeter
            booked={day.booked}
            capacity={day.capacity}
            isPast={isPast}
          />
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Mini icon={<UserCheck />} label="Iscritti" value={confirmed} />
            <Mini icon={<CalendarCheck2 />} label="Liberi" value={free} />
            <Mini icon={<Hourglass />} label="In lista" value={waiting} />
          </div>
          {held > 0 && (
            <p className="mt-2 text-xs text-muted">
              {held} {held === 1 ? "posto proposto" : "posti proposti"} alla
              lista d&apos;attesa, in attesa di conferma.
            </p>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-danger/25 bg-danger/[0.05] p-3.5 text-sm">
          <p className="font-semibold text-ink">Giornata chiusa</p>
          <p className="mt-0.5 text-muted">
            {day.closureReason || "Nessun motivo indicato."}
          </p>
          {!isPast && (
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              disabled={saving}
              onClick={() =>
                run(
                  { ...day, isOpen: true, closureReason: null },
                  { notice: "none" },
                )
              }
            >
              <CalendarCheck2 /> Riapri giornata
            </Button>
          )}
        </div>
      )}

      <div className="mt-5 space-y-4">
        <div className="rounded-xl border border-line p-3.5">
          <Toggle
            id="day-open"
            label="Aula studio aperta"
            checked={draft.isOpen}
            onChange={(v) =>
              setDraft({
                ...draft,
                isOpen: v,
                closureReason: v ? null : (draft.closureReason ?? ""),
              })
            }
          />
        </div>
        {!draft.isOpen && (
          <Field
            label="Motivo della chiusura"
            htmlFor="day-reason"
            hint="Visibile agli studenti nel calendario e nelle email."
          >
            <TextInput
              id="day-reason"
              value={draft.closureReason ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, closureReason: e.target.value })
              }
              placeholder="Es. Assemblea d'istituto"
              maxLength={200}
            />
          </Field>
        )}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Apertura" htmlFor="day-opens">
            <TextInput
              id="day-opens"
              type="time"
              step={300}
              value={draft.opensAt}
              onChange={(e) => setDraft({ ...draft, opensAt: e.target.value })}
            />
          </Field>
          <Field label="Chiusura" htmlFor="day-closes">
            <TextInput
              id="day-closes"
              type="time"
              step={300}
              value={draft.closesAt}
              onChange={(e) => setDraft({ ...draft, closesAt: e.target.value })}
            />
          </Field>
          <Field label="Capienza" htmlFor="day-capacity">
            <TextInput
              id="day-capacity"
              type="number"
              min={1}
              max={500}
              value={draft.capacity}
              onChange={(e) =>
                setDraft({ ...draft, capacity: Number(e.target.value) })
              }
            />
          </Field>
        </div>
        {(capacityError || hoursError) && (
          <p className="text-xs font-medium text-danger">
            {capacityError ?? hoursError}
          </p>
        )}
        <Field label="Nota per gli studenti" htmlFor="day-note">
          <TextInput
            id="day-note"
            value={draft.note ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, note: e.target.value || null })
            }
            placeholder="Facoltativa"
            maxLength={300}
          />
        </Field>
        <Button
          className="w-full"
          variant={closing ? "danger" : "primary"}
          disabled={
            saving ||
            !dirty ||
            Boolean(capacityError || hoursError) ||
            (!draft.isOpen && !draft.closureReason?.trim())
          }
          onClick={submit}
        >
          {closing ? <CalendarX2 /> : <Save />}{" "}
          {closing ? "Chiudi la giornata" : "Salva modifiche"}
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-4 text-sm font-semibold">
        <Link
          href={`${base}/iscritti?giorno=${day.day}`}
          className="flex items-center gap-1.5 text-ink-soft hover:text-ink"
        >
          <Users className="size-4" /> Elenco iscritti
        </Link>
        <Link
          href={`${base}/comunicazioni?giorno=${day.day}`}
          className="flex items-center gap-1.5 text-ink-soft hover:text-ink"
        >
          <Megaphone className="size-4" /> Scrivi agli iscritti
        </Link>
      </div>

      {confirm && (
        <ClosureSheet
          open={confirm}
          day={draft}
          booked={confirmed + held}
          waiting={waiting}
          saving={saving}
          onClose={() => setConfirm(false)}
          onConfirm={(n) => run(draft, n)}
        />
      )}
    </section>
  );
}

function ClosureSheet({
  open,
  day,
  booked,
  waiting,
  saving,
  onClose,
  onConfirm,
}: {
  open: boolean;
  day: CalendarDay;
  booked: number;
  waiting: number;
  saving: boolean;
  onClose: () => void;
  onConfirm: (n: ClosureNotice) => void;
}) {
  const [notice, setNotice] = useState<ClosureNotice["notice"]>("default");
  const [subject, setSubject] = useState(`Aula studio chiusa`);
  const [message, setMessage] = useState(
    `ti informiamo che l'aula studio resterà chiusa ${formatDayLong(day.day)}.\nMotivo: ${day.closureReason ?? ""}\n\nCi scusiamo per il disagio: puoi prenotare un'altra giornata dal calendario.`,
  );
  const total = booked + waiting;
  const options: {
    value: ClosureNotice["notice"];
    title: string;
    text: string;
  }[] = [
    {
      value: "default",
      title: "Avviso automatico",
      text: "Email standard con il motivo della chiusura.",
    },
    {
      value: "custom",
      title: "Messaggio personalizzato",
      text: "Scrivi tu oggetto e testo dell'email.",
    },
    {
      value: "none",
      title: "Non inviare email",
      text: "Gli studenti vedranno la chiusura solo nel calendario.",
    },
  ];
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Chiudere la giornata?"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Annulla
          </Button>
          <Button
            variant="danger"
            disabled={
              saving ||
              (notice === "custom" &&
                (subject.trim().length < 3 || message.trim().length < 5))
            }
            onClick={() => onConfirm({ notice, subject, message })}
          >
            <CalendarX2 /> {saving ? "Chiusura in corso…" : "Conferma chiusura"}
          </Button>
        </>
      }
    >
      <p>
        <strong className="text-ink first-letter:uppercase">
          {formatDayMedium(day.day)}
        </strong>{" "}
        ha{" "}
        <strong className="text-ink">
          {booked} {booked === 1 ? "studente prenotato" : "studenti prenotati"}
        </strong>{" "}
        e <strong className="text-ink">{waiting} in lista d&apos;attesa</strong>
        . Chiudendo, nessuno potrà usare il posto e la lista d&apos;attesa viene
        sospesa. Se in seguito riapri la giornata, le prenotazioni tornano
        valide.
      </p>
      <fieldset className="mt-4 space-y-2">
        <legend className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink">
          <Mail className="size-3.5" /> Comunicazione a {total}{" "}
          {total === 1 ? "studente" : "studenti"}
        </legend>
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex cursor-pointer gap-3 rounded-xl border p-3 transition",
              notice === o.value
                ? "border-ink bg-ink/[0.03]"
                : "border-line hover:border-ink/30",
            )}
          >
            <input
              type="radio"
              name="closure-notice"
              value={o.value}
              checked={notice === o.value}
              onChange={() => setNotice(o.value)}
              className="mt-1 accent-[var(--ink)]"
            />
            <span>
              <span className="block text-sm font-semibold text-ink">
                {o.title}
              </span>
              <span className="block text-xs">{o.text}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {notice === "custom" && (
        <div className="mt-4 space-y-3">
          <Field label="Oggetto" htmlFor="closure-subject">
            <TextInput
              id="closure-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={150}
            />
          </Field>
          <Field
            label="Messaggio"
            htmlFor="closure-message"
            hint="L'email inizia con «Ciao» e il nome dello studente."
          >
            <TextArea
              id="closure-message"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={5000}
            />
          </Field>
        </div>
      )}
    </Sheet>
  );
}
