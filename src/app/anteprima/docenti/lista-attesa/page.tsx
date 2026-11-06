"use client";

import { TeacherWaitlistView } from "@/components/teacher/views/TeacherWaitlistView";
import { demoDay, demoWaitlistFor } from "@/lib/demo/data";
import type { WaitlistDashboardData } from "@/lib/waitlist/types";

/** Anteprima con dati dimostrativi della dashboard lista d'attesa. */
const days = ["2026-11-25", "2026-12-02"];
const data: WaitlistDashboardData = {
  offerMinutes: 120,
  cancellationHours: 24,
  totalWaiting: 10,
  pendingOffers: [
    { id: "p1", day: "2026-11-25", studentName: "Alessandro Prova", className: "4A", status: "pending", offeredAt: "2026-11-23T08:12:30Z", expiresAt: "2026-11-23T10:12:30Z", respondedAt: null, endReason: null },
  ],
  expiredOffers: [
    { id: "x1", day: "2026-12-02", studentName: "Chiara Demo", className: "5B", status: "expired", offeredAt: "2026-11-22T15:00:00Z", expiresAt: "2026-11-22T17:00:00Z", respondedAt: null, endReason: "Nessuna conferma entro il tempo previsto" },
  ],
  days: days.map((day, di) => {
    const d = demoDay(day)!;
    const queue = demoWaitlistFor(day);
    return {
      id: `d${di}`,
      day,
      capacity: d.capacity,
      confirmed: d.booked - (di === 0 ? 1 : 0),
      held: di === 0 ? 1 : 0,
      waiting: queue.length - (di === 0 ? 1 : 0),
      isOpen: true,
      paused: di === 1,
      waitlistOpen: di === 0,
      opensAt: "14:15",
      entries: queue.map((w, i) => ({
        id: `${day}-${i}`,
        studentName: w.name,
        className: w.className,
        email: "",
        joinedAt: `2026-11-2${i % 3}T1${i}:0${i}:00Z`,
        status: di === 0 && i === 0 ? ("offered" as const) : ("waiting" as const),
        position: di === 0 ? (i === 0 ? null : i) : i + 1,
        endReason: null,
        offer: di === 0 && i === 0 ? { status: "pending" as const, offeredAt: "2026-11-23T08:12:30Z", expiresAt: "2026-11-23T10:12:30Z" } : null,
      })),
    };
  }),
};

const noop = async () => ({ ok: true, message: "Anteprima: nessuna modifica salvata." });

export default function PreviewTeacherWaitlist() {
  return <TeacherWaitlistView data={data} actions={{ setOfferMinutes: noop, setPaused: noop, removeEntry: noop }} />;
}
