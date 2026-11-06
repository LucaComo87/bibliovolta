import type { StatsData } from "@/components/teacher/views/TeacherStatsView";
import type { TeacherStatsJson } from "@/lib/database.types";

const WD = ["", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const short = (day: string) => new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
const medium = (day: string) => new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));

/** Converte il risultato di teacher_stats() nel formato dei grafici. */
export function toStatsData(s: TeacherStatsJson): StatsData {
  return {
    totalBookings: s.total_bookings ?? 0,
    avgDaily: Number(s.avg_daily ?? 0),
    avgOccupancy: Number(s.avg_occupancy ?? 0),
    waiting: s.waiting ?? 0,
    fullDays: s.full_days ?? 0,
    uniqueStudents: s.unique_students ?? 0,
    registeredStudents: s.registered_students ?? 0,
    cancellations: s.cancellations ?? 0,
    referenceDays: s.reference_days ?? 0,
    weeks: (s.weeks ?? []).slice(-8).map((w) => ({ label: short(w.week_start), value: Math.round(Number(w.occupancy)) })),
    weekdays: (s.weekdays ?? []).filter((w) => w.dow <= 5).map((w) => ({ label: WD[w.dow], value: Math.round(Number(w.occupancy)) })),
    topDays: (s.top_days ?? []).map((d) => ({ label: medium(d.day), value: d.n, hint: `${d.n} su ${d.capacity} posti` })),
    classes: (s.classes ?? []).slice(0, 8).map((c) => ({ label: c.class_name, value: c.n })),
  };
}
