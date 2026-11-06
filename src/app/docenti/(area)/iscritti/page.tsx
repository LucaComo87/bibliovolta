import { LiveTeacherRoster } from "@/components/teacher/live/LiveTeacherRoster";
import { requireRole } from "@/lib/auth/session";
import { ROUTES } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRoster } from "@/lib/teacher/data";

/** Elenco degli iscritti di una giornata (dati reali). */
export default async function TeacherRosterPage({ searchParams }: PageProps<"/docenti/iscritti">) {
  await requireRole("teacher");
  const { giorno } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const data = await getRoster(supabase, typeof giorno === "string" ? giorno : null);
  return <LiveTeacherRoster key={data.day?.day} base={ROUTES.teacher} data={data} />;
}
