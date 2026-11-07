"use client";

import { TeacherShiftsView } from "@/components/teacher/views/TeacherShiftsView";
import { DEMO_TODAY, demoDays } from "@/lib/demo/data";
import type { ShiftMap } from "@/lib/teacher/types";

/** Anteprima con dati dimostrativi: nessuna modifica viene salvata. */
export default function PreviewTeacherShifts() {
  const days = demoDays().map((d) => ({ ...d, id: d.id ?? d.day }));
  const names = ["Prof.ssa Anna Esempio", "Prof. Marco Esempio", "Prof.ssa Giulia Esempio"];
  const shifts: ShiftMap = {};
  days.filter((d) => d.isOpen && d.day >= DEMO_TODAY).forEach((d, i) => {
    if (i % 4 !== 3) shifts[d.day] = [{ id: `${d.day}-${i}`, name: names[i % 3], mine: i % 3 === 0, registered: true }];
  });
  return <TeacherShiftsView today={DEMO_TODAY} days={days} shifts={shifts} viewer={{ id: "demo", isAdmin: true, maxPerDay: 3 }} />;
}
