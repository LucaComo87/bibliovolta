"use client";

import { removeWaitlistEntry, setOfferMinutes, setWaitlistPaused } from "@/app/docenti/(area)/waitlist-actions";
import { useLiveClock } from "@/components/student/live/useLiveClock";
import { TeacherWaitlistView } from "@/components/teacher/views/TeacherWaitlistView";
import type { WaitlistDashboardData } from "@/lib/waitlist/types";

export function LiveTeacherWaitlist({ data, nowIso }: { data: WaitlistDashboardData; nowIso: string }) {
  useLiveClock(nowIso); // la dashboard si aggiorna da sola ogni 30 secondi
  return <TeacherWaitlistView data={data} actions={{ setOfferMinutes, setPaused: setWaitlistPaused, removeEntry: removeWaitlistEntry }} />;
}
