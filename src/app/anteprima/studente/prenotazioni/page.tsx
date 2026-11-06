"use client";

import { StudentBookingsView } from "@/components/student/views/StudentBookingsView";
import { useDemoStudent } from "@/lib/demo/student-store";

export default function PreviewStudentBookings() {
  const s = useDemoStudent();
  return <StudentBookingsView base="/anteprima/studente" today={s.today} now={s.now} bookings={s.bookings} onCancel={async (id) => {
    s.cancel(id);
    return { ok: true };
  }} />;
}
