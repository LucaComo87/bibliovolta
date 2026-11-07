"use client";

import type { ReactNode } from "react";
import { assignShift, removeShift, takeShift, updateDay } from "@/app/docenti/(area)/manage-actions";
import { TeacherCalendarView } from "@/components/teacher/views/TeacherCalendarView";
import type { CalendarDay } from "@/lib/calendar";
import type { ShiftMap, ShiftViewer } from "@/lib/teacher/types";

/** Calendario gestionale reale: ogni modifica passa da teacher_update_day nel database. */
export function LiveTeacherCalendar({
  base,
  today,
  days,
  aside,
  shifts,
  viewer,
}: {
  base: string;
  today: string;
  days: CalendarDay[];
  aside?: ReactNode;
  shifts: ShiftMap;
  viewer: ShiftViewer;
}) {
  return (
    <TeacherCalendarView
      base={base}
      today={today}
      days={days}
      aside={aside}
      shifts={shifts}
      viewer={viewer}
      shiftActions={{ take: takeShift, assign: assignShift, remove: removeShift }}
      onSave={(d, n) =>
        updateDay({
          id: d.id,
          isOpen: d.isOpen,
          capacity: d.capacity,
          opensAt: d.opensAt,
          closesAt: d.closesAt,
          closureReason: d.closureReason ?? null,
          note: d.note ?? null,
          notice: n.notice,
          subject: n.subject ?? null,
          message: n.message ?? null,
        })
      }
    />
  );
}
