"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type HoursState = { ok?: boolean; error?: string; updated?: number };

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Orario non valido");

/** Cambia l'orario di apertura e chiusura (predefinito e giornate future). Solo docenti. */
export async function setOpeningHours(_prev: HoursState, formData: FormData): Promise<HoursState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "teacher" || user.mustChangePassword) return { error: "Operazione riservata ai docenti." };
  const parsed = z.object({ opensAt: time, closesAt: time }).safeParse({ opensAt: formData.get("opensAt"), closesAt: formData.get("closesAt") });
  if (!parsed.success) return { error: "Inserisci orari validi (hh:mm)." };
  if (parsed.data.closesAt <= parsed.data.opensAt) return { error: "L'orario di chiusura deve essere successivo a quello di apertura." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("set_opening_hours", { p_opens_at: parsed.data.opensAt, p_closes_at: parsed.data.closesAt });
  if (error) return { error: error.message.replace(/^BIBLIOVOLTA:\s*/, "") };
  refresh();
  return { ok: true, updated: data ?? 0 };
}
