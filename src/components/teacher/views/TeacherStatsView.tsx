import { BarChart3, CalendarCheck2, CalendarDays, GraduationCap, Hourglass, Percent, Ticket, TrendingUp, Users, XCircle } from "lucide-react";
import { BarChart, HBarList } from "@/components/ui/BarChart";
import { Card, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeading } from "@/components/ui/PageHeading";
import { StatCard } from "@/components/ui/StatCard";

/** Statistiche già pronte per la visualizzazione (da teacher_stats o dai dati dimostrativi). */
export type StatsData = {
  totalBookings: number;
  avgDaily: number;
  avgOccupancy: number;
  waiting: number;
  fullDays: number;
  uniqueStudents: number;
  registeredStudents: number;
  cancellations: number;
  referenceDays: number;
  weeks: { label: string; value: number }[];
  weekdays: { label: string; value: number }[];
  topDays: { label: string; value: number; hint?: string }[];
  classes: { label: string; value: number }[];
};

const fmt = (n: number, digits = 0) => n.toLocaleString("it-IT", { maximumFractionDigits: digits, minimumFractionDigits: digits });

export function TeacherStatsView({ stats, note }: { stats: StatsData; note?: string }) {
  return (
    <>
      <PageHeading eyebrow="Statistiche" title="Come viene usata l'aula studio">
        {note ?? "Dati reali dall'inizio della stagione, aggiornati a ogni apertura della pagina."}
      </PageHeading>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Prenotazioni" value={fmt(stats.totalBookings)} icon={<Ticket />} hint="confermate in totale" />
        <StatCard label="Media giornaliera" value={fmt(stats.avgDaily, 1)} icon={<TrendingUp />} hint={`su ${stats.referenceDays} giornate aperte`} />
        <StatCard label="Occupazione" value={`${fmt(stats.avgOccupancy)}%`} icon={<Percent />} hint="media dei posti occupati" />
        <StatCard label="In lista d'attesa" value={fmt(stats.waiting)} icon={<Hourglass />} hint="studenti in coda ora" />
        <StatCard label="Giornate complete" value={fmt(stats.fullDays)} icon={<CalendarCheck2 />} hint="tutti i posti occupati" />
        <StatCard label="Studenti" value={fmt(stats.uniqueStudents)} icon={<Users />} hint={`su ${fmt(stats.registeredStudents)} registrati`} />
        <StatCard label="Annullamenti" value={fmt(stats.cancellations)} icon={<XCircle />} hint="prenotazioni annullate" />
        <StatCard label="Giornate" value={fmt(stats.referenceDays)} icon={<CalendarDays />} hint="aperte con prenotazioni possibili" />
      </div>
      {stats.totalBookings === 0 ? (
        <div className="mt-6">
          <EmptyState icon={<BarChart3 />} title="Ancora nessuna prenotazione">I grafici compariranno con le prime prenotazioni degli studenti.</EmptyState>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardTitle eyebrow="Andamento">Occupazione per settimana</CardTitle>
            <BarChart data={stats.weeks} ariaLabel="Occupazione media per settimana" />
          </Card>
          <Card>
            <CardTitle eyebrow="Abitudini">Occupazione per giorno della settimana</CardTitle>
            <BarChart data={stats.weekdays} ariaLabel="Occupazione media per giorno della settimana" />
          </Card>
          <Card>
            <CardTitle icon={<CalendarCheck2 />} eyebrow="Affluenza">Le giornate più frequentate</CardTitle>
            <HBarList data={stats.topDays} labelWidth="9.5rem" />
          </Card>
          <Card>
            <CardTitle icon={<GraduationCap />} eyebrow="Classi">Le classi più rappresentate</CardTitle>
            <HBarList data={stats.classes} unit="" />
          </Card>
        </div>
      )}
    </>
  );
}
