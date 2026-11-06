"use client";

import { StudentWaitlistView } from "@/components/student/views/StudentWaitlistView";
import { useDemoStudent } from "@/lib/demo/student-store";

export default function PreviewStudentWaitlist() {
  const s = useDemoStudent();
  return <StudentWaitlistView base="/anteprima/studente" waitlist={s.waitlist} onLeave={s.leaveWaitlist} onAccept={s.acceptOffer} onDecline={s.declineOffer} />;
}
