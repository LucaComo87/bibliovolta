"use client";

import { StudentHome } from "@/components/student/views/StudentHome";
import { DEMO_ANNOUNCEMENTS, DEMO_STUDENT } from "@/lib/demo/data";
import { useDemoStudent } from "@/lib/demo/student-store";

export default function PreviewStudentHome() {
  const s = useDemoStudent();
  return (
    <StudentHome
      firstName={DEMO_STUDENT.firstName}
      base="/anteprima/studente"
      today={s.today}
      now={s.now}
      days={s.days}
      bookings={s.bookings}
      waitlist={s.waitlist}
      announcements={DEMO_ANNOUNCEMENTS.slice(0, 2)}
      onBook={s.book}
      onCancel={s.cancel}
      onAccept={s.acceptOffer}
      onDecline={s.declineOffer}
    />
  );
}
