"use client";

import { countRecipients, retryAnnouncement, sendAnnouncement } from "@/app/docenti/(area)/manage-actions";
import { TeacherAnnouncementsView } from "@/components/teacher/views/TeacherAnnouncementsView";
import type { AnnouncementSummary, ComposerDay } from "@/lib/teacher/types";

/** Comunicazioni reali: conteggio, invio e nuovo invio passano dal database e dal servizio email. */
export function LiveTeacherAnnouncements(props: { days: ComposerDay[]; announcements: AnnouncementSummary[]; initialDay: string | null; author: string; siteUrl: string }) {
  return <TeacherAnnouncementsView {...props} actions={{ count: countRecipients, send: sendAnnouncement, retry: retryAnnouncement }} />;
}
