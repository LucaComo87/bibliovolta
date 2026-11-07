"use client";

import { ArrowDownAZ, ChevronLeft, ChevronRight, FileSpreadsheet, FileText, Hourglass, Search, Sparkles, UserX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Select, TextArea, TextInput } from "@/components/ui/Field";
import { PageHeading } from "@/components/ui/PageHeading";
import { SeatMeter } from "@/components/ui/SeatMeter";
import { Sheet } from "@/components/ui/Sheet";
import { Toast } from "@/components/ui/Toast";
import { formatDateTime, formatDayMedium } from "@/lib/dates";
import type { RosterData, RosterRow } from "@/lib/teacher/types";

type SortKey = "lastName" | "firstName" | "className" | "bookedAt";
const SORTS: Record<SortKey, string> = { lastName: "Cognome (A–Z)", firstName: "Nome (A–Z)", className: "Classe", bookedAt: "Data di prenotazione" };
const coll = new Intl.Collator("it", { sensitivity: "base", numeric: true });

function sortRows(rows: RosterRow[], key: SortKey) {
  return [...rows].sort((a, b) => {
    if (key === "bookedAt") return a.bookedAt.localeCompare(b.bookedAt);
    if (key === "className") return coll.compare(a.className ?? "", b.className ?? "") || coll.compare(a.lastName, b.lastName);
    if (key === "firstName") return coll.compare(a.firstName, b.firstName) || coll.compare(a.lastName, b.lastName);
    return coll.compare(a.lastName, b.lastName) || coll.compare(a.firstName, b.firstName);
  });
}

/**
 * Elenco degli studenti prenotati per una giornata: ricerca, filtro per
 * classe, ordinamento, esportazione CSV/Excel e annullamento manuale.
 */
export function TeacherRosterView({
  base,
  data,
  exportHref,
  onCancel,
}: {
  base: string;
  data: RosterData;
  /** link di esportazione reale (assente nell'anteprima) */
  exportHref?: (format: "csv" | "xlsx") => string;
  onCancel?: (bookingId: string, reason: string, notify: boolean) => Promise<{ ok: boolean; message?: string }>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [klass, setKlass] = useState("");
  const [sort, setSort] = useState<SortKey>("lastName");
  const [target, setTarget] = useState<RosterRow | null>(null);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);
  const day = data.day;
  const idx = day ? data.days.findIndex((d) => d.day === day.day) : -1;
  const prev = idx > 0 ? data.days[idx - 1] : null;
  const next = idx >= 0 && idx < data.days.length - 1 ? data.days[idx + 1] : null;
  const classes = useMemo(() => ([...new Set(data.rows.map((r) => r.className).filter(Boolean))] as string[]).sort(coll.compare), [data.rows]);
  const q = query.trim().toLowerCase();
  const visible = sortRows(
    data.rows.filter((r) => (!klass || r.className === klass) && (!q || `${r.firstName} ${r.lastName} ${r.lastName} ${r.firstName}`.toLowerCase().includes(q))),
    sort,
  );

  if (!day) {
    return (
      <>
        <PageHeading eyebrow="Elenco degli iscritti" title="Chi viene in biblioteca" />
        <EmptyState icon={<Search />} title="Nessuna giornata in calendario">Le giornate della stagione non sono ancora state create.</EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeading
        eyebrow="Elenco degli iscritti"
        title="Chi viene in biblioteca"
        action={
          <div className="flex flex-wrap gap-2">
            {exportHref ? (
              <>
                <a href={exportHref("csv")} className={buttonClasses("secondary")} download><FileText /> Esporta CSV</a>
                <a href={exportHref("xlsx")} className={buttonClasses("secondary")} download><FileSpreadsheet /> Esporta Excel</a>
              </>
            ) : (
              <>
                <Button variant="secondary" disabled title="Non disponibile nell'anteprima"><FileText /> Esporta CSV</Button>
                <Button variant="secondary" disabled title="Non disponibile nell'anteprima"><FileSpreadsheet /> Esporta Excel</Button>
              </>
            )}
          </div>
        }
      >
        L&apos;elenco della giornata, da consultare all&apos;ingresso dell&apos;aula studio.
      </PageHeading>

      <div className="mb-6 flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-soft lg:flex-row lg:items-center sm:p-5">
        <div className="flex items-center gap-2">
          <Link aria-label="Giornata precedente" aria-disabled={!prev} href={prev ? `${base}/iscritti?giorno=${prev.day}` : "#"} className={`grid size-10 shrink-0 place-items-center rounded-lg border border-line hover:bg-ink/5 ${prev ? "" : "pointer-events-none opacity-30"}`}>
            <ChevronLeft className="size-4" />
          </Link>
          <div className="min-w-0 flex-1 sm:w-80 sm:flex-none">
            <label htmlFor="roster-day" className="sr-only">Giornata</label>
            <Select id="roster-day" value={day.day} onChange={(e) => router.push(`${base}/iscritti?giorno=${e.target.value}`)}>
              {data.days.map((d) => (
                <option key={d.day} value={d.day}>
                  {formatDayMedium(d.day)} · {d.isOpen ? `${d.booked} prenotati` : "chiusa"}
                </option>
              ))}
            </Select>
          </div>
          <Link aria-label="Giornata successiva" aria-disabled={!next} href={next ? `${base}/iscritti?giorno=${next.day}` : "#"} className={`grid size-10 shrink-0 place-items-center rounded-lg border border-line hover:bg-ink/5 ${next ? "" : "pointer-events-none opacity-30"}`}>
            <ChevronRight className="size-4" />
          </Link>
        </div>
        <div className="flex-1 lg:border-l lg:border-line lg:pl-5">
          {day.isOpen ? (
            <SeatMeter booked={data.rows.length} capacity={day.capacity} />
          ) : (
            <p className="text-sm text-muted"><Badge tone="danger" className="mr-2">Chiusa</Badge>{day.closureReason}</p>
          )}
          <p className="mt-1 text-xs text-muted">
            Orario {day.opensAt}–{day.closesAt} ·{" "}
            <span className={data.supervisors.length ? "font-medium text-ink-soft" : "font-medium text-warn"} data-testid="roster-supervisors">
              {data.supervisors.length ? `Di turno: ${data.supervisors.join(", ")}` : "Nessun docente di turno"}
            </span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[1.8fr_1fr] 2xl:items-start [&>*]:min-w-0">
        <Card className="p-0 sm:p-0">
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:p-5">
            <h2 className="font-display text-lg font-semibold text-ink">
              Prenotati <span className="text-muted tabular">· {visible.length}{visible.length !== data.rows.length ? ` di ${data.rows.length}` : ""}</span>
            </h2>
            <div className="grid gap-2 sm:grid-cols-[1fr_11rem_13rem]">
              <div>
                <label htmlFor="roster-search" className="sr-only">Cerca per nome o cognome</label>
                <TextInput id="roster-search" icon={<Search />} placeholder="Cerca per nome o cognome" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <div>
                <label htmlFor="roster-class" className="sr-only">Filtra per classe</label>
                <Select id="roster-class" value={klass} onChange={(e) => setKlass(e.target.value)}>
                  <option value="">Tutte le classi</option>
                  {classes.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
              <div>
                <label htmlFor="roster-sort" className="sr-only">Ordina per</label>
                <Select id="roster-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                  {Object.entries(SORTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </Select>
              </div>
            </div>
          </div>
          {visible.length ? (
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.1em] text-muted">
                    <th className="px-5 py-3 font-semibold"><span className="inline-flex items-center gap-1">Cognome e nome {sort === "lastName" && <ArrowDownAZ className="size-3.5" />}</span></th>
                    <th className="px-3 py-3 font-semibold">Classe</th>
                    <th className="hidden px-3 py-3 font-semibold lg:table-cell">Email</th>
                    <th className="hidden whitespace-nowrap px-3 py-3 font-semibold md:table-cell">Prenotato il</th>
                    <th className="px-5 py-3 text-right font-semibold"><span className="sr-only">Azioni</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visible.map((r) => (
                    <tr key={r.bookingId} className="transition hover:bg-paper" data-testid="roster-row">
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={`${r.firstName} ${r.lastName}`} size="sm" className="ring-0 ring-offset-0" />
                          <div className="min-w-0">
                            <p className="font-semibold text-ink"><span className="uppercase">{r.lastName}</span> {r.firstName}</p>
                            <p className="truncate text-xs text-muted lg:hidden">{r.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">{r.className ? <Badge tone="blue">{r.className}</Badge> : "—"}</td>
                      <td className="hidden px-3 py-2.5 text-muted lg:table-cell">{r.email}</td>
                      <td className="hidden whitespace-nowrap px-3 py-2.5 text-muted tabular md:table-cell">{formatDateTime(r.bookedAt)}</td>
                      <td className="px-5 py-2.5 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setTarget(r)} aria-label={`Annulla la prenotazione di ${r.firstName} ${r.lastName}`}>
                          <UserX /> <span className="hidden sm:inline">Annulla</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-5">
              <EmptyState icon={<Search />} title={data.rows.length ? "Nessun risultato" : "Nessun prenotato"}>
                {data.rows.length ? "Prova con un altro nome o un'altra classe." : "Per questa giornata non ci sono prenotazioni confermate."}
              </EmptyState>
            </div>
          )}
          {data.cancelled.length > 0 && (
            <details className="border-t border-line p-4 sm:p-5">
              <summary className="cursor-pointer text-sm font-semibold text-ink">Prenotazioni annullate · {data.cancelled.length}</summary>
              <ul className="mt-3 space-y-2 text-sm">
                {data.cancelled.map((c) => (
                  <li key={c.bookingId} className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-ink"><span className="uppercase">{c.lastName}</span> {c.firstName} {c.className && <span className="text-muted">· {c.className}</span>}</span>
                    <span className="text-xs text-muted">
                      {c.byTeacher ? `Annullata dai docenti${c.reason ? `: ${c.reason}` : ""}` : "Annullata dallo studente"} · {formatDateTime(c.cancelledAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>

        <Card>
          <CardTitle icon={<Hourglass />} eyebrow="Lista d'attesa">In coda per questa giornata</CardTitle>
          {data.waitlist.length ? (
            <ol className="space-y-2">
              {data.waitlist.map((w) => (
                <li key={w.id} className="flex items-center gap-3 rounded-lg border border-line p-2.5 text-sm">
                  <span className="grid size-7 place-items-center rounded-full bg-ink/[0.06] text-xs font-semibold text-ink tabular">{w.position ?? "★"}</span>
                  <span className="flex-1 font-medium text-ink">{w.name}</span>
                  {w.className && <Badge tone="blue">{w.className}</Badge>}
                  {w.status === "offered" && <Badge tone="gold" icon={<Sparkles />}>Proposto</Badge>}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted">Nessuno in lista per questa giornata.</p>
          )}
        </Card>
      </div>

      <CancelSheet
        key={target?.bookingId}
        row={target}
        day={day.day}
        onClose={() => setTarget(null)}
        onConfirm={async (reason, notify) => {
          if (!target) return;
          const res = onCancel ? await onCancel(target.bookingId, reason, notify) : null;
          if (res && !res.ok) {
            setToast({ title: "Annullamento non riuscito", body: res.message ?? "Riprova." });
          } else {
            setTarget(null);
            setToast({
              title: "Prenotazione annullata",
              body: res ? `${target.firstName} ${target.lastName}${notify ? " riceverà un'email con il motivo." : " non riceverà email."} Il posto passa alla lista d'attesa.` : "Anteprima: nessuna modifica salvata.",
            });
          }
          setTimeout(() => setToast(null), 5000);
        }}
      />
      {toast && <Toast title={toast.title} body={toast.body} onClose={() => setToast(null)} />}
    </>
  );
}

function CancelSheet({ row, day, onClose, onConfirm }: { row: RosterRow | null; day: string; onClose: () => void; onConfirm: (reason: string, notify: boolean) => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      open={Boolean(row)}
      onClose={onClose}
      title="Annullare la prenotazione?"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Indietro</Button>
          <Button
            variant="danger"
            disabled={busy || reason.trim().length < 3}
            onClick={async () => {
              setBusy(true);
              await onConfirm(reason, notify);
              setBusy(false);
            }}
          >
            <UserX /> {busy ? "Annullamento…" : "Annulla prenotazione"}
          </Button>
        </>
      }
    >
      {row && (
        <p>
          Stai annullando la prenotazione di <strong className="text-ink">{row.firstName} {row.lastName}</strong>
          {row.className ? ` (${row.className})` : ""} per <strong className="text-ink">{formatDayMedium(day)}</strong>. Il posto liberato viene proposto al primo in lista d&apos;attesa.
        </p>
      )}
      <div className="mt-4 space-y-3">
        <Field label="Motivo (obbligatorio)" htmlFor="cancel-reason" hint="Resta nel registro delle operazioni e, se scegli, arriva allo studente.">
          <TextArea id="cancel-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Es. Uscita didattica della classe" />
        </Field>
        <label className="flex items-center gap-2.5 text-sm text-ink">
          <input id="cancel-notify" type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="size-4 rounded accent-[var(--ink)]" />
          Avvisa lo studente per email
        </label>
      </div>
    </Sheet>
  );
}
