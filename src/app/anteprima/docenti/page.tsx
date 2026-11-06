import { TeacherDashboard } from "@/components/teacher/views/TeacherDashboard";
import { DEMO_ACTIVITY, DEMO_TEACHER, DEMO_TODAY, demoDays, demoWaitlistFor } from "@/lib/demo/data";
import type { DashboardData } from "@/lib/teacher/types";

/** Anteprima con dati dimostrativi della dashboard docenti. */
export default function PreviewTeacherDashboard() {
  const days = demoDays();
  const future = days.filter((d) => d.day >= DEMO_TODAY && d.isOpen);
  const t = days.find((d) => d.day === DEMO_TODAY)!;
  const short = (day: string) => new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
  const data: DashboardData = {
    today: DEMO_TODAY,
    todayDay: { id: t.day, day: t.day, booked: t.booked, capacity: t.capacity, isOpen: t.isOpen, closureReason: t.closureReason ?? null, opensAt: t.opensAt, closesAt: t.closesAt },
    registeredStudents: 468,
    fullDays: future.filter((d) => d.booked >= d.capacity).length,
    closedDays: days.filter((d) => !d.isOpen).length,
    waiting: 9,
    upcoming: future.slice(0, 8).map((d) => ({ id: d.day, day: d.day, booked: d.booked, held: 0, capacity: d.capacity, waiting: demoWaitlistFor(d.day).length, opensAt: d.opensAt, closesAt: d.closesAt })),
    chart: future.slice(0, 10).map((d) => ({ label: short(d.day), value: Math.round((d.booked / d.capacity) * 100) })),
    activity: DEMO_ACTIVITY.slice(0, 5),
  };
  return <TeacherDashboard base="/anteprima/docenti" teacherName={`${DEMO_TEACHER.title} ${DEMO_TEACHER.fullName.split(" ")[1]}`} data={data} />;
}
