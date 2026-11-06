"use client";

import { AlertTriangle, CheckCircle2, Clock, Eye, Hourglass, Mail, Megaphone, RotateCcw, Send, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Select, TextArea, TextInput } from "@/components/ui/Field";
import { PageHeading } from "@/components/ui/PageHeading";
import { Sheet } from "@/components/ui/Sheet";
import { Toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { formatDateTime, formatDayLong, formatDayMedium } from "@/lib/dates";
import { renderNotification } from "@/lib/email/templates";
import type { AnnouncementSummary, ComposerDay } from "@/lib/teacher/types";
import { ANNOUNCEMENT_TEMPLATES, type AnnouncementCategory } from "@/lib/teacher/templates";

export type AnnouncementActions = {
  count: (dayId: string, includeBookings: boolean, includeWaitlist: boolean) => Promise<number | null>;
  send: (input: {
    schoolDayId: string;
    includeBookings: boolean;
    includeWaitlist: boolean;
    subject: string;
    body: string;
    category: AnnouncementCategory;
  }) => Promise<{ ok: boolean; message?: string; data?: Record<string, number | boolean> }>;
  retry: (announcementId: string) => Promise<{ ok: boolean; message?: string; data?: Record<string, number | boolean> }>;
};

/**
 * Comunicazioni via email agli iscritti di una giornata: scelta della
 * giornata e dei destinatari, modelli pronti, anteprima dell'email,
 * conferma e storico con l'esito di ogni invio.
 */
export function TeacherAnnouncementsView({
  days,
  announcements,
  initialDay,
  author,
  siteUrl,
  actions,
}: {
  days: ComposerDay[];
  announcements: AnnouncementSummary[];
  initialDay?: string | null;
  author: string;
  siteUrl: string;
  /** azioni reali; assenti nell'anteprima */
  actions?: AnnouncementActions;
}) {
  const router = useRouter();
  const first = days.find((d) => d.day === initialDay) ?? days.find((d) => d.isOpen && d.booked > 0) ?? days[0];
  const [dayId, setDayId] = useState(first?.id ?? "");
  const [includeBookings, setIncludeBookings] = useState(true);
  const [includeWaitlist, setIncludeWaitlist] = useState(false);
  const [category, setCategory] = useState<AnnouncementCategory>("altro");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [confirm, setConfirm] = useState<{ count: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);
  const day = days.find((d) => d.id === dayId);
  const estimate = day ? (includeBookings ? day.booked : 0) + (includeWaitlist ? day.waiting : 0) : 0;
  const valid = Boolean(day) && (includeBookings || includeWaitlist) && subject.trim().length >= 3 && body.trim().length >= 5;
  const hasPending = announcements.some((a) => a.pending > 0);

  // finché ci sono email in coda, aggiorna lo stato degli invii
  useEffect(() => {
    if (!hasPending || !actions) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [hasPending, actions, router]);

  const notify = (title: string, text: string) => {
    setToast({ title, body: text });
    setTimeout(() => setToast(null), 5000);
  };

  const applyTemplate = (cat: AnnouncementCategory) => {
    setCategory(cat);
    const t = ANNOUNCEMENT_TEMPLATES.find((x) => x.category === cat);
    if (!t || !day) return;
    setSubject(t.subject);
    setBody(t.body(formatDayLong(day.day), "dalle 14:15 alle 16:00"));
  };

  const openConfirm = async () => {
    if (!day) return;
    setBusy(true);
    const exact = actions ? await actions.count(day.id, includeBookings, includeWaitlist) : estimate;
    setBusy(false);
    setConfirm({ count: exact ?? estimate });
  };

  const send = async () => {
    if (!day) return;
    setBusy(true);
    const res = actions ? await actions.send({ schoolDayId: day.id, includeBookings, includeWaitlist, subject, body, category }) : null;
    setBusy(false);
    setConfirm(null);
    if (res && !res.ok) return notify("Comunicazione non inviata", res.message ?? "Riprova.");
    if (!res) return notify("Comunicazione pronta", "Anteprima: nessuna email è stata inviata.");
    const n = Number(res.data?.recipients ?? 0);
    setSubject("");
    setBody("");
    setCategory("altro");
    notify("Comunicazione in invio", `${n} ${n === 1 ? "email messa" : "email messe"} in coda. L'esito compare nello storico.`);
  };

  const preview = day
    ? renderNotification(
        "announcement",
        { subject: subject || "Oggetto della comunicazione", body: body || "Il testo del messaggio comparirà qui.", day: day.day, author, first_name: "Giulia" },
        siteUrl,
      )
    : null;

  return (
    <>
      <PageHeading eyebrow="Comunicazioni" title="Scrivi agli iscritti">
        Le email partono dal servizio configurato verso gli studenti prenotati e, se vuoi, verso quelli in lista d&apos;attesa.
      </PageHeading>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.05fr] xl:items-start [&>*]:min-w-0">
        <Card>
          <CardTitle icon={<Megaphone />} eyebrow="Nuova comunicazione">Componi</CardTitle>
          {days.length === 0 ? (
            <EmptyState icon={<Megaphone />} title="Nessuna giornata futura">Non ci sono giornate a cui inviare comunicazioni.</EmptyState>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void openConfirm();
              }}
            >
              <Field label="Giornata" htmlFor="ann-day">
                <Select id="ann-day" value={dayId} onChange={(e) => setDayId(e.target.value)}>
                  {days.map((d) => (
                    <option key={d.id} value={d.id}>
                      {formatDayMedium(d.day)} · {d.isOpen ? `${d.booked} prenotati, ${d.waiting} in attesa` : "chiusa"}
                    </option>
                  ))}
                </Select>
              </Field>
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-ink">Destinatari</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Audience id="ann-bookings" icon={<Users />} label="Studenti prenotati" count={day?.booked ?? 0} checked={includeBookings} onChange={setIncludeBookings} />
                  <Audience id="ann-waitlist" icon={<Hourglass />} label="Lista d'attesa" count={day?.waiting ?? 0} checked={includeWaitlist} onChange={setIncludeWaitlist} />
                </div>
                <p className="mt-2 text-sm text-muted" data-testid="recipients-estimate">
                  Destinatari: <strong className="text-ink tabular">{estimate}</strong> {estimate === 1 ? "studente" : "studenti"}
                </p>
              </fieldset>
              <div>
                <p className="mb-2 text-sm font-semibold text-ink">Modelli</p>
                <div className="flex flex-wrap gap-2">
                  {ANNOUNCEMENT_TEMPLATES.map((t) => (
                    <button
                      key={t.category}
                      type="button"
                      onClick={() => applyTemplate(t.category)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                        category === t.category ? "border-ink bg-ink text-white" : "border-line text-ink-soft hover:border-ink/40 hover:text-ink",
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <Field label="Oggetto" htmlFor="ann-subject">
                <TextInput id="ann-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Es. Cambio di orario" maxLength={150} />
              </Field>
              <Field label="Messaggio" htmlFor="ann-body" hint="L'email inizia con «Ciao» e il nome dello studente; la firma è aggiunta in automatico.">
                <TextArea id="ann-body" rows={7} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Scrivi qui il testo della comunicazione" maxLength={5000} />
              </Field>
              <Button type="submit" size="lg" className="w-full" disabled={!valid || busy || estimate === 0}>
                <Send /> INVIA COMUNICAZIONE AGLI ISCRITTI
              </Button>
              {valid && estimate === 0 && <p className="text-xs text-muted">Nessuno studente da avvisare con i destinatari scelti.</p>}
            </form>
          )}
        </Card>

        <Card className="xl:sticky xl:top-8">
          <CardTitle icon={<Eye />} eyebrow="Anteprima">Così arriva l&apos;email</CardTitle>
          {preview ? (
            <>
              <div className="mb-3 rounded-lg bg-paper px-3 py-2 text-xs text-muted">
                <span className="font-semibold text-ink">Oggetto:</span> {preview.subject}
              </div>
              <iframe title="Anteprima dell'email" srcDoc={preview.html} sandbox="" className="h-[30rem] w-full rounded-xl border border-line bg-white" />
            </>
          ) : (
            <p className="text-sm text-muted">Scegli una giornata.</p>
          )}
        </Card>
      </div>

      <section aria-labelledby="sent" className="mt-8 space-y-3">
        <h2 id="sent" className="font-display text-xl font-semibold text-ink">Comunicazioni inviate</h2>
        {announcements.length === 0 ? (
          <p className="text-sm text-muted">Nessuna comunicazione inviata finora.</p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {announcements.map((a) => (
              <SentItem
                key={a.id}
                a={a}
                onRetry={async () => {
                  const res = actions ? await actions.retry(a.id) : null;
                  if (res && !res.ok) notify("Nuovo invio non riuscito", res.message ?? "Riprova.");
                  else notify("Email rimesse in coda", res ? `${res.data?.requeued ?? 0} email verranno reinviate.` : "Anteprima: nessuna email reinviata.");
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <Sheet
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title="Confermi l'invio?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)} disabled={busy}>Modifica</Button>
            <Button onClick={send} disabled={busy || !confirm?.count}>
              <Send /> {busy ? "Invio…" : `Invia a ${confirm?.count ?? 0} ${confirm?.count === 1 ? "studente" : "studenti"}`}
            </Button>
          </>
        }
      >
        {day && (
          <div className="space-y-3">
            <p>
              L&apos;email <strong className="text-ink">«{subject.trim()}»</strong> verrà inviata a{" "}
              <strong className="text-ink" data-testid="confirm-count">{confirm?.count ?? 0}</strong>{" "}
              {[includeBookings && "studenti prenotati", includeWaitlist && "studenti in lista d'attesa"].filter(Boolean).join(" e ")} per{" "}
              <strong className="text-ink">{formatDayMedium(day.day)}</strong>.
            </p>
            {confirm?.count === 0 && <p className="font-medium text-danger">Nessun destinatario: la comunicazione non può essere inviata.</p>}
            <p className="text-xs">L&apos;invio viene registrato nel registro delle operazioni insieme all&apos;esito di ogni email.</p>
          </div>
        )}
      </Sheet>
      {toast && <Toast title={toast.title} body={toast.body} onClose={() => setToast(null)} />}
    </>
  );
}

function Audience({ id, icon, label, count, checked, onChange }: { id: string; icon: React.ReactNode; label: string; count: number; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition", checked ? "border-ink bg-ink/[0.03]" : "border-line hover:border-ink/30")}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 rounded accent-[var(--ink)]" />
      <span className="text-ink-soft [&_svg]:size-4">{icon}</span>
      <span className="flex-1 text-sm font-medium text-ink">{label}</span>
      <span className="text-sm font-semibold text-ink tabular">{count}</span>
    </label>
  );
}

function SentItem({ a, onRetry }: { a: AnnouncementSummary; onRetry: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const total = Math.max(a.recipients, a.sent + a.failed + a.pending, 1);
  const audience = [a.includeBookings && "prenotati", a.includeWaitlist && "lista d'attesa"].filter(Boolean).join(" + ");
  return (
    <li className="flex flex-col rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-soft" data-testid="announcement-item">
      <div className="flex flex-wrap items-center gap-2">
        {a.day && <Badge tone="gold" icon={<Users />}>{formatDayMedium(a.day)}</Badge>}
        <Badge tone="blue">{audience}</Badge>
        <span className="text-xs text-muted">{formatDateTime(a.publishedAt)} · {a.author}</span>
      </div>
      <h3 className="mt-2 font-semibold text-ink">{a.title}</h3>
      <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-muted">{a.body}</p>
      <div className="mt-auto pt-4">
        <div className="flex h-2 overflow-hidden rounded-full bg-ink/[0.06]" aria-hidden>
          <span className="bg-ok" style={{ width: `${(a.sent / total) * 100}%` }} />
          <span className="bg-danger" style={{ width: `${(a.failed / total) * 100}%` }} />
          <span className="bg-gold/60" style={{ width: `${(a.pending / total) * 100}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1"><Mail className="size-3.5" /> {a.recipients} destinatari</span>
          <span className="flex items-center gap-1 text-ok" data-testid="sent-count"><CheckCircle2 className="size-3.5" /> {a.sent} inviate</span>
          {a.failed > 0 && <span className="flex items-center gap-1 text-danger" data-testid="failed-count"><AlertTriangle className="size-3.5" /> {a.failed} non recapitate</span>}
          {a.pending > 0 && <span className="flex items-center gap-1"><Clock className="size-3.5" /> {a.pending} in coda</span>}
        </div>
        {a.failed > 0 && (
          <div className="mt-3 rounded-lg border border-danger/25 bg-danger/[0.04] p-3 text-xs">
            <ul className="space-y-1 text-muted">
              {a.failures.slice(0, 4).map((f, i) => (
                <li key={i}><span className="font-medium text-ink">{f.email}</span>{f.error ? ` — ${f.error}` : ""}</li>
              ))}
              {a.failures.length > 4 && <li>… e altre {a.failures.length - 4}</li>}
            </ul>
            <Button
              variant="secondary"
              size="sm"
              className="mt-2"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await onRetry();
                setBusy(false);
              }}
            >
              <RotateCcw /> Riprova l&apos;invio
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}
