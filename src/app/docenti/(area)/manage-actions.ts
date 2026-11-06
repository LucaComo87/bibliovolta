"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { dispatchSoon } from "@/lib/email/outbox";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Operazioni della dashboard docenti (Fase 6). Ogni azione verifica il
 * ruolo, passa per una funzione del database (che ricontrolla il ruolo,
 * scrive il registro delle operazioni e mette in coda le email) e poi
 * avvia subito l'invio delle email.
 */
export type ManageResult = { ok: boolean; message?: string; data?: Record<string, number | boolean> };

async function teacherClient() {
  const user = await getCurrentUser();
  if (!user || user.role !== "teacher" || user.mustChangePassword) return null;
  return createSupabaseServerClient();
}
const clean = (m?: string) => (m ?? "Operazione non riuscita.").replace(/^BIBLIOVOLTA:\s*/, "");
const DENIED: ManageResult = { ok: false, message: "Operazione riservata ai docenti." };
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const daySchema = z.object({
  id: z.string().uuid(),
  isOpen: z.boolean(),
  capacity: z.number().int().min(1).max(500),
  opensAt: time,
  closesAt: time,
  closureReason: z.string().trim().max(200).nullable().optional(),
  note: z.string().trim().max(300).nullable().optional(),
  notice: z.enum(["default", "custom", "none"]).default("default"),
  subject: z.string().trim().max(150).nullable().optional(),
  message: z.string().trim().max(5000).nullable().optional(),
});

/** Apre, chiude o modifica una giornata (orario, capienza, nota) con comunicazione facoltativa. */
export async function updateDay(input: unknown): Promise<ManageResult> {
  const supabase = await teacherClient();
  if (!supabase) return DENIED;
  const parsed = daySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Dati non validi." };
  const d = parsed.data;
  if (d.closesAt <= d.opensAt) return { ok: false, message: "L'orario di chiusura deve essere successivo a quello di apertura." };
  if (!d.isOpen && !d.closureReason) return { ok: false, message: "Indica il motivo della chiusura." };
  const { data, error } = await supabase.rpc("teacher_update_day", {
    p_school_day_id: d.id,
    p_is_open: d.isOpen,
    p_capacity: d.capacity,
    p_opens_at: d.opensAt,
    p_closes_at: d.closesAt,
    p_note: d.note || null,
    p_closure_reason: d.isOpen ? null : (d.closureReason ?? null),
    p_notice: d.notice,
    p_subject: d.subject || null,
    p_message: d.message || null,
  });
  refresh();
  after(dispatchSoon);
  if (error) return { ok: false, message: clean(error.message) };
  const r = (data ?? {}) as { booked?: number; waiting?: number; notified?: number; is_open?: boolean };
  return { ok: true, data: { booked: r.booked ?? 0, waiting: r.waiting ?? 0, notified: r.notified ?? 0, isOpen: r.is_open ?? d.isOpen } };
}

/** Annullamento manuale di una prenotazione con motivazione (email facoltativa allo studente). */
export async function teacherCancelBooking(bookingId: string, reason: string, notify: boolean): Promise<ManageResult> {
  const supabase = await teacherClient();
  if (!supabase) return DENIED;
  if (!z.string().uuid().safeParse(bookingId).success) return { ok: false, message: "Prenotazione non valida." };
  const motivo = reason.trim();
  if (motivo.length < 3) return { ok: false, message: "Indica il motivo dell'annullamento." };
  const { error } = await supabase.rpc("teacher_cancel_booking", { p_booking_id: bookingId, p_reason: motivo.slice(0, 300), p_notify: notify });
  refresh();
  after(dispatchSoon);
  return error ? { ok: false, message: clean(error.message) } : { ok: true };
}

/** Numero di destinatari di una comunicazione (calcolato dal database). */
export async function countRecipients(schoolDayId: string, includeBookings: boolean, includeWaitlist: boolean): Promise<number | null> {
  const supabase = await teacherClient();
  if (!supabase || !z.string().uuid().safeParse(schoolDayId).success) return null;
  const { data, error } = await supabase.rpc("announcement_recipients_count", {
    p_school_day_id: schoolDayId,
    p_include_bookings: includeBookings,
    p_include_waitlist: includeWaitlist,
  });
  return error ? null : (data ?? 0);
}

const announcementSchema = z.object({
  schoolDayId: z.string().uuid(),
  includeBookings: z.boolean(),
  includeWaitlist: z.boolean(),
  subject: z.string().trim().min(3, "L'oggetto deve avere almeno 3 caratteri.").max(150),
  body: z.string().trim().min(5, "Il messaggio è troppo breve.").max(5000),
  category: z.enum(["annullamento", "modifica_orario", "chiusura_straordinaria", "avviso_urgente", "altro"]).default("altro"),
});

/** Invia una comunicazione email agli iscritti di una giornata. */
export async function sendAnnouncement(input: unknown): Promise<ManageResult> {
  const supabase = await teacherClient();
  if (!supabase) return DENIED;
  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dati non validi." };
  const a = parsed.data;
  if (!a.includeBookings && !a.includeWaitlist) return { ok: false, message: "Scegli almeno un gruppo di destinatari." };
  const { data, error } = await supabase.rpc("send_announcement", {
    p_school_day_id: a.schoolDayId,
    p_include_bookings: a.includeBookings,
    p_include_waitlist: a.includeWaitlist,
    p_subject: a.subject,
    p_body: a.body,
    p_category: a.category,
  });
  refresh();
  after(dispatchSoon);
  if (error) return { ok: false, message: clean(error.message) };
  return { ok: true, data: { recipients: data?.[0]?.recipients ?? 0 } };
}

/** Rimette in coda le email non recapitate di una comunicazione. */
export async function retryAnnouncement(announcementId: string): Promise<ManageResult> {
  const supabase = await teacherClient();
  if (!supabase || !z.string().uuid().safeParse(announcementId).success) return DENIED;
  const { data, error } = await supabase.rpc("retry_announcement", { p_announcement_id: announcementId });
  refresh();
  after(dispatchSoon);
  return error ? { ok: false, message: clean(error.message) } : { ok: true, data: { requeued: data ?? 0 } };
}
