"use client";

import { StudentCalendarView } from "@/components/student/views/StudentCalendarView";
import { DEMO_STUDENT } from "@/lib/demo/data";
import { useDemoStudent } from "@/lib/demo/student-store";

export default function PreviewStudentCalendar() {
  const s = useDemoStudent();
  return (
    <StudentCalendarView
      today={s.today}
      now={s.now}
      days={s.days}
      bookings={s.bookings}
      waitlist={s.waitlist}
      profile={{ name: DEMO_STUDENT.fullName, className: DEMO_STUDENT.className }}
      onBook={async (d) => {
        s.book(d.day);
        return { ok: true };
      }}
      onAcceptOffer={(id) => {
        const w = s.waitlist.find((x) => x.id === id || (x as { offerId?: string }).offerId === id);
        if (w) s.acceptOffer(w.id);
      }}
      onDeclineOffer={(id) => {
        const w = s.waitlist.find((x) => x.id === id || (x as { offerId?: string }).offerId === id);
        if (w) s.declineOffer(w.id);
      }}
      onCancel={async (id) => {
        s.cancel(id);
        return { ok: true };
      }}
      onJoinWaitlist={(d) => s.joinWaitlist(d.day)}
      onLeaveWaitlist={s.leaveWaitlist}
    />
  );
}
