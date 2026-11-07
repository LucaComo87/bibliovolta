"use client";

import { assignShift, removeShift, takeShift } from "@/app/docenti/(area)/manage-actions";
import { TeacherShiftsView } from "@/components/teacher/views/TeacherShiftsView";
import type { CalendarDay } from "@/lib/calendar";
import type { ShiftMap, ShiftViewer } from "@/lib/teacher/types";

/** Turni di sorveglianza reali: ogni operazione passa dalle funzioni del database. */
export function LiveTeacherShifts(props: { today: string; days: CalendarDay[]; shifts: ShiftMap; viewer: ShiftViewer }) {
  return <TeacherShiftsView {...props} actions={{ take: takeShift, assign: assignShift, remove: removeShift }} />;
}
