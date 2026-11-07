import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ShiftMap } from "./types";

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** Docenti di turno di tutte le giornate (visibili solo ai docenti, per la RLS). */
export async function getShiftMap(supabase: Client, viewerId: string): Promise<ShiftMap> {
  const { data, error } = await supabase
    .from("supervision_shifts")
    .select("id, teacher_id, teacher_name, created_at, school_days(day)")
    .order("created_at");
  // migrazione 10 non ancora applicata: il resto dell'area docenti continua a funzionare
  if (error) {
    console.error("BIBLIOVOLTA: turni non disponibili:", error.message);
    return {};
  }
  const map: ShiftMap = {};
  for (const row of (data ?? []) as unknown as { id: string; teacher_id: string | null; teacher_name: string; school_days: { day: string } | null }[]) {
    const day = row.school_days?.day;
    if (!day) continue;
    (map[day] ??= []).push({ id: row.id, name: row.teacher_name, mine: row.teacher_id === viewerId, registered: Boolean(row.teacher_id) });
  }
  return map;
}

export async function getMaxShiftsPerDay(supabase: Client): Promise<number> {
  const { data } = await supabase.from("app_settings").select("max_shifts_per_day").eq("id", 1).single();
  return data?.max_shifts_per_day ?? 3;
}
