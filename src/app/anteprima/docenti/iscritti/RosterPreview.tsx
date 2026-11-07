"use client";

import { useSearchParams } from "next/navigation";
import { TeacherRosterView } from "@/components/teacher/views/TeacherRosterView";
import { DEMO_TODAY, demoDays, demoRoster, demoWaitlistFor } from "@/lib/demo/data";
import type { RosterData } from "@/lib/teacher/types";

/** Anteprima con dati dimostrativi: nessuna esportazione né modifica reale. */
export function RosterPreview() {
  const wanted = useSearchParams().get("giorno") ?? DEMO_TODAY;
  const all = demoDays();
  const d = all.find((x) => x.day === wanted && x.isOpen) ?? all.find((x) => x.day >= wanted && x.isOpen)!;
  const people = demoRoster(d.day);
  const split = (name: string) => ({ firstName: name.split(" ")[0], lastName: name.split(" ").slice(1).join(" ") });
  const data: RosterData = {
    day: { id: d.day, day: d.day, capacity: d.capacity, opensAt: d.opensAt, closesAt: d.closesAt, isOpen: d.isOpen, closureReason: d.closureReason ?? null },
    days: all.map((x) => ({ day: x.day, booked: x.booked, isOpen: x.isOpen })),
    supervisors: ["Prof.ssa Anna Esempio"],
    rows: people.filter((p) => p.status === "confirmed").map((p) => ({
      bookingId: p.id, studentId: p.id, ...split(p.name), className: p.className, email: p.email, bookedAt: p.bookedAt, source: "student" as const,
    })),
    cancelled: people.filter((p) => p.status === "cancelled").map((p) => ({
      bookingId: p.id, studentId: p.id, ...split(p.name), className: p.className, email: p.email, bookedAt: p.bookedAt, source: "student" as const,
      cancelledAt: p.bookedAt, reason: null, byTeacher: false,
    })),
    waitlist: demoWaitlistFor(d.day).map((w) => ({ id: w.id, position: w.status === "offered" ? null : w.position, name: w.name, className: w.className, status: w.status, joinedAt: "2026-11-20T10:00:00Z" })),
  };
  return <TeacherRosterView key={d.day} base="/anteprima/docenti" data={data} />;
}
