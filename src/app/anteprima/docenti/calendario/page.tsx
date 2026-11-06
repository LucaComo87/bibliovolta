"use client";

import { TeacherCalendarView } from "@/components/teacher/views/TeacherCalendarView";
import { DEMO_TODAY, demoDays } from "@/lib/demo/data";

export default function PreviewTeacherCalendar() {
  return <TeacherCalendarView base="/anteprima/docenti" today={DEMO_TODAY} days={demoDays()} />;
}
