"use client";

import { teacherCancelBooking } from "@/app/docenti/(area)/manage-actions";
import { TeacherRosterView } from "@/components/teacher/views/TeacherRosterView";
import type { RosterData } from "@/lib/teacher/types";

/** Elenco iscritti reale: esportazione e annullamento collegati al database. */
export function LiveTeacherRoster({ base, data }: { base: string; data: RosterData }) {
  return (
    <TeacherRosterView
      base={base}
      data={data}
      exportHref={(f) => `${base}/iscritti/esporta?giorno=${data.day?.day ?? ""}&formato=${f}`}
      onCancel={teacherCancelBooking}
    />
  );
}
