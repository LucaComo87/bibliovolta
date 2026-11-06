import { LiveTeacherAnnouncements } from "@/components/teacher/live/LiveTeacherAnnouncements";
import { requireRole } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAnnouncements, getComposerDays } from "@/lib/teacher/data";

/** Comunicazioni email agli iscritti (dati e invii reali). */
export default async function TeacherAnnouncementsPage({ searchParams }: PageProps<"/docenti/comunicazioni">) {
  const { profile } = await requireRole("teacher");
  const { giorno } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [days, announcements] = await Promise.all([getComposerDays(supabase), getAnnouncements(supabase)]);
  return (
    <LiveTeacherAnnouncements
      days={days}
      announcements={announcements}
      initialDay={typeof giorno === "string" ? giorno : null}
      author={profile.full_name || profile.email}
      siteUrl={publicEnv.siteUrl}
    />
  );
}
