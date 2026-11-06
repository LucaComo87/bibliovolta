import { TeacherAnnouncementsView } from "@/components/teacher/views/TeacherAnnouncementsView";
import { DEMO_ANNOUNCEMENTS, DEMO_TEACHER, DEMO_TODAY, demoDays, demoWaitlistFor } from "@/lib/demo/data";
import type { AnnouncementSummary } from "@/lib/teacher/types";

/** Anteprima con dati dimostrativi: nessuna email viene inviata. */
export default function PreviewTeacherAnnouncements() {
  const days = demoDays()
    .filter((d) => d.day >= DEMO_TODAY)
    .slice(0, 40)
    .map((d) => ({ id: d.day, day: d.day, booked: d.booked, waiting: demoWaitlistFor(d.day).length, isOpen: d.isOpen }));
  const announcements: AnnouncementSummary[] = DEMO_ANNOUNCEMENTS.filter((a) => a.day).concat([
    { ...DEMO_ANNOUNCEMENTS[0], id: "a4", title: "Cambio di orario", day: "2026-11-24", recipients: 44, emailSent: 42, publishedAt: "2026-11-22T16:20:00Z" },
  ]).map((a, i) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    day: a.day ?? null,
    author: a.author,
    publishedAt: a.publishedAt,
    includeBookings: true,
    includeWaitlist: i === 1,
    recipients: a.recipients,
    sent: a.emailSent,
    failed: a.recipients - a.emailSent,
    pending: 0,
    failures: a.recipients > a.emailSent ? [{ email: "nome.cognome@stud.liceovoltacomo.edu.it", error: "Casella di posta piena (esempio)" }] : [],
  }));
  return (
    <TeacherAnnouncementsView
      days={days}
      announcements={announcements}
      initialDay="2026-11-25"
      author={`${DEMO_TEACHER.title} ${DEMO_TEACHER.fullName}`}
      siteUrl="https://bibliovolta.example"
    />
  );
}
