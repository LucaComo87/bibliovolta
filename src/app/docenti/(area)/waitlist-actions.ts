"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { dispatchSoon } from "@/lib/email/outbox";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TeacherActionResult = { ok: boolean; message?: string };

async function teacherClient() {
  const user = await getCurrentUser();
  if (!user || user.role !== "teacher" || user.mustChangePassword) return null;
  return createSupabaseServerClient();
}
const clean = (m?: string) => (m ?? "Operazione non riuscita.").replace(/^BIBLIOVOLTA:\s*/, "");
const uuid = z.string().uuid();

/** Tempo concesso per confermare una proposta (minuti). */
export async function setOfferMinutes(_prev: TeacherActionResult, formData: FormData): Promise<TeacherActionResult> {
  const supabase = await teacherClient();
  if (!supabase) return { ok: false, message: "Operazione riservata ai docenti." };
  const hours = Number(formData.get("hours") ?? 0);
  const minutes = Number(formData.get("minutes") ?? 0);
  const total = Math.round(hours * 60 + minutes);
  const { error } = await supabase.rpc("set_offer_minutes", { p_minutes: total });
  if (error) return { ok: false, message: clean(error.message) };
  refresh();
  return { ok: true, message: "Tempo di conferma aggiornato. Vale per le prossime proposte." };
}

/** Sospende o riattiva la lista d'attesa di una giornata. */
export async function setWaitlistPaused(schoolDayId: string, paused: boolean): Promise<TeacherActionResult> {
  const supabase = await teacherClient();
  if (!supabase || !uuid.safeParse(schoolDayId).success) return { ok: false, message: "Operazione non consentita." };
  const { error } = await supabase.rpc("set_waitlist_paused", { p_school_day_id: schoolDayId, p_paused: paused });
  refresh();
  after(dispatchSoon);
  return error ? { ok: false, message: clean(error.message) } : { ok: true };
}

/** Rimuove uno studente dalla lista (con una proposta aperta, il posto passa al successivo). */
export async function removeWaitlistEntry(entryId: string): Promise<TeacherActionResult> {
  const supabase = await teacherClient();
  if (!supabase || !uuid.safeParse(entryId).success) return { ok: false, message: "Operazione non consentita." };
  const { error } = await supabase.rpc("teacher_remove_waitlist_entry", { p_entry_id: entryId });
  refresh();
  after(dispatchSoon);
  return error ? { ok: false, message: clean(error.message) } : { ok: true };
}
