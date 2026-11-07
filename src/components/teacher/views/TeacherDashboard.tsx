import { ArrowRight, CalendarCheck2, CalendarOff, CalendarRange, Hourglass, ScrollText, Send, ShieldAlert, ShieldCheck, UserCheck, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { BarChart } from "@/components/ui/BarChart";
import { Card, CardTitle } from "@/components/ui/Card";
import { PageHeading } from "@/components/ui/PageHeading";
import { SeatMeter } from "@/components/ui/SeatMeter";
import { StatCard } from "@/components/ui/StatCard";
import { availabilityLevel, STATUS_LABEL } from "@/lib/calendar";
import { formatDateTime, formatDayMedium } from "@/lib/dates";
import { describeActivity } from "@/lib/teacher/activity";
import type { DashboardData, ShiftMap } from "@/lib/teacher/types";

const toneDot = { neutral: "bg-ink/30", gold: "bg-gold", danger: "bg-danger", success: "bg-ok" } as const;

/** Dashboard docenti: numeri chiave, occupazione delle prossime giornate e ultime operazioni. */
export function TeacherDashboard({ base, teacherName, data, shifts }: { base: string; teacherName: string; data: DashboardData; shifts?: ShiftMap }) {
  const t = data.todayDay;
  const onDuty = (day: string) => (shifts?.[day] ?? []).map((x) => x.name);
  const uncovered = shifts ? data.upcoming.filter((d) => !onDuty(d.day).length).length : 0;
  return (
    <>
      <PageHeading
        eyebrow={formatDayMedium(data.today)}
        title={`Buongiorno, ${teacherName}`}
        action={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`${base}/calendario`} variant="secondary"><CalendarOff /> Gestisci giornate</ButtonLink>
            <ButtonLink href={`${base}/comunicazioni`}><Send /> INVIA COMUNICAZIONE AGLI ISCRITTI</ButtonLink>
          </div>
        }
      >
        Tutta l&apos;aula studio in una pagina: prenotazioni, giornate e comunicazioni.
      </PageHeading>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5" data-testid="dashboard-stats">
        <StatCard
          label="Oggi"
          value={t ? (t.isOpen ? `${t.booked}/${t.capacity}` : "Chiusa") : "—"}
          icon={<UserCheck />}
          hint={
            t
              ? t.isOpen
                ? `prenotazioni · ${t.opensAt}–${t.closesAt}${shifts ? ` · di turno: ${onDuty(t.day).join(", ") || "nessuno"}` : ""}`
                : t.closureReason ?? "giornata chiusa"
              : "nessuna apertura oggi"
          }
          className="col-span-2 lg:col-span-1"
        />
        <StatCard label="Iscritti" value={data.registeredStudents.toLocaleString("it-IT")} icon={<Users />} hint="studenti registrati" />
        <StatCard label="Complete" value={data.fullDays} icon={<CalendarCheck2 />} hint="prossime giornate al completo" />
        <StatCard label="Chiuse" value={data.closedDays} icon={<CalendarOff />} hint="giornate chiuse nella stagione" />
        <StatCard label="In attesa" value={data.waiting} icon={<Hourglass />} hint="studenti in lista d'attesa" />
      </div>

      {uncovered > 0 && (
        <Link
          href={`${base}/turni`}
          className="mt-4 flex items-center gap-3 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm font-medium text-warn hover:border-warn/60"
          data-testid="uncovered-alert"
        >
          <ShieldAlert className="size-5 shrink-0" />
          <span>
            {uncovered === 1 ? "1 delle prossime giornate non ha" : `${uncovered} delle prossime giornate non hanno`} un docente di turno.{" "}
            <span className="underline underline-offset-2">Organizza i turni</span>
          </span>
        </Link>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardTitle eyebrow="Prossime giornate prenotabili">Occupazione dei posti</CardTitle>
          {data.chart.length ? <BarChart data={data.chart} ariaLabel="Occupazione delle prossime giornate" /> : <p className="text-sm text-muted">Nessuna giornata aperta in programma.</p>}
        </Card>
        <Card>
          <CardTitle
            eyebrow="Registro"
            icon={<ScrollText />}
            action={<Link href={`${base}/registro`} className="flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink">Tutto <ArrowRight className="size-4" /></Link>}
          >
            Ultime operazioni
          </CardTitle>
          {data.activity.length ? (
            <ol className="relative space-y-4 border-l border-line pl-5">
              {data.activity.map((a) => {
                const d = describeActivity(a);
                return (
                  <li key={a.id} className="relative">
                    <span className={`absolute -left-[25px] top-1.5 size-2.5 rounded-full ring-4 ring-surface ${toneDot[d.tone]}`} />
                    <p className="text-sm text-ink first-letter:uppercase">{d.title}</p>
                    <p className="text-xs text-muted">{formatDateTime(a.at)} · {a.actor}</p>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-sm text-muted">Nessuna operazione registrata finora.</p>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardTitle
          icon={<CalendarRange />}
          eyebrow="Prossime giornate"
          action={<Link href={`${base}/calendario`} className="flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink">Calendario <ArrowRight className="size-4" /></Link>}
        >
          Prenotazioni e lista d&apos;attesa
        </CardTitle>
        <ul className="divide-y divide-line">
          {data.upcoming.map((d) => {
            const level = availabilityLevel({ booked: d.booked + d.held, capacity: d.capacity, isOpen: true });
            return (
              <li key={d.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 py-3 sm:grid-cols-[12rem_1fr_auto]">
                <p className="text-sm font-semibold text-ink first-letter:uppercase">
                  {formatDayMedium(d.day)}
                  {d.day === data.today && <Badge tone="blue" className="ml-2">Oggi</Badge>}
                  <span className="block text-xs font-normal text-muted">{d.opensAt}–{d.closesAt}</span>
                  {shifts && (
                    <span className={`flex items-center gap-1 text-xs font-medium ${onDuty(d.day).length ? "text-ink-soft" : "text-warn"}`} data-testid="dashboard-shift">
                      <ShieldCheck className="size-3.5 shrink-0" />
                      {onDuty(d.day).length ? `Di turno: ${onDuty(d.day).join(", ")}` : "Nessun docente di turno"}
                    </span>
                  )}
                </p>
                <div className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
                  <SeatMeter booked={d.booked + d.held} capacity={d.capacity} size="sm" showLabel={false} />
                </div>
                <div className="flex items-center gap-2 justify-self-end">
                  <span className="text-sm font-semibold text-ink tabular">{d.booked + d.held}/{d.capacity}</span>
                  {d.waiting > 0 && <Badge tone="gold" icon={<Hourglass />}>{d.waiting}</Badge>}
                  <Badge tone={level === "available" ? "success" : level === "limited" ? "warning" : "danger"}>{STATUS_LABEL[level]}</Badge>
                  <Link href={`${base}/iscritti?giorno=${d.day}`} className="rounded-lg p-1.5 text-muted hover:bg-ink/5 hover:text-ink" aria-label={`Iscritti di ${formatDayMedium(d.day)}`}>
                    <Users className="size-4" />
                  </Link>
                </div>
              </li>
            );
          })}
          {data.upcoming.length === 0 && <li className="py-3 text-sm text-muted">Nessuna giornata aperta in programma.</li>}
        </ul>
      </Card>
    </>
  );
}
