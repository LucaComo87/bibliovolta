"use client";

import type { ReactNode } from "react";
import { updateDay } from "@/app/docenti/(area)/manage-actions";
import { TeacherCalendarView } from "@/components/teacher/views/TeacherCalendarView";
import type { CalendarDay } from "@/lib/calendar";

/** Calendario gestionale reale: ogni modifica passa da teacher_update_day nel database. */
export function LiveTeacherCalendar({ base, today, days, aside }: { base: string; today: string; days: CalendarDay[]; aside?: ReactNode }) {
  return (
    <TeacherCalendarView
      base={base}
      today={today}
      days={days}
      aside={aside}
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
