"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { toBookingError } from "@/lib/bookings/server";
import type { BookingResult } from "@/lib/bookings/types";
import { dispatchSoon } from "@/lib/email/outbox";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();

async function requireRegisteredStudent() {
  const user = await getCurrentUser();
  if (!user || user.role !== "student" || user.needsRegistration) return null;
  return user;
}

/**
 * Prenota un posto. Tutti i controlli (capienza 50, una prenotazione per
 * giornata, giornata aperta, prima dell'apertura) avvengono nel database
 * dentro book_seat, in modo atomico. Qui si verifica solo chi chiama.
 */
export async function bookSeat(schoolDayId: string): Promise<BookingResult> {
  if (!(await requireRegisteredStudent())) return { ok: false, code: "not_allowed", message: "Sessione non valida. Accedi di nuovo." };
  const parsed = uuid.safeParse(schoolDayId);
  if (!parsed.success) return { ok: false, code: "not_found", message: "Giornata non valida." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("book_seat", { p_school_day_id: parsed.data });
  refresh(); // calendario e area personale si aggiornano subito, anche in caso di errore (es. posti esauriti)
  if (error || !data) return toBookingError(error);
  return { ok: true, bookingId: data.id };
}

/** Annulla una propria prenotazione; la scadenza delle 24 ore è verificata nel database. */
export async function cancelBooking(bookingId: string): Promise<BookingResult> {
  if (!(await requireRegisteredStudent())) return { ok: false, code: "not_allowed", message: "Sessione non valida. Accedi di nuovo." };
  const parsed = uuid.safeParse(bookingId);
  if (!parsed.success) return { ok: false, code: "not_found", message: "Prenotazione non valida." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("cancel_booking", { p_booking_id: parsed.data });
  refresh();
  after(dispatchSoon); // l'eventuale proposta al primo in lista parte subito
  if (error || !data) return toBookingError(error);
  return { ok: true, bookingId: data.id };
}

// ---------------------------------------------------------------------
// Lista d'attesa
// ---------------------------------------------------------------------

/** Iscrizione alla lista d'attesa di una giornata completa. */
export async function joinWaitlist(schoolDayId: string): Promise<BookingResult & { position?: number }> {
  if (!(await requireRegisteredStudent())) return { ok: false, code: "not_allowed", message: "Sessione non valida. Accedi di nuovo." };
  const parsed = uuid.safeParse(schoolDayId);
  if (!parsed.success) return { ok: false, code: "not_found", message: "Giornata non valida." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("join_waitlist", { p_school_day_id: parsed.data });
  refresh();
  if (error || !data?.[0]) return toBookingError(error);
  return { ok: true, position: data[0].queue_position };
}

/** Uscita dalla lista (con una proposta aperta, il posto passa al successivo). */
export async function leaveWaitlist(entryId: string): Promise<BookingResult> {
  if (!(await requireRegisteredStudent())) return { ok: false, code: "not_allowed", message: "Sessione non valida. Accedi di nuovo." };
  const parsed = uuid.safeParse(entryId);
  if (!parsed.success) return { ok: false, code: "not_found", message: "Iscrizione non valida." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("leave_waitlist", { p_entry_id: parsed.data });
  refresh();
  after(dispatchSoon);
  return error ? toBookingError(error) : { ok: true };
}

/** Conferma di un posto proposto, dall'area personale. */
export async function acceptMyOffer(offerId: string): Promise<BookingResult> {
  if (!(await requireRegisteredStudent())) return { ok: false, code: "not_allowed", message: "Sessione non valida. Accedi di nuovo." };
  const parsed = uuid.safeParse(offerId);
  if (!parsed.success) return { ok: false, code: "not_found", message: "Proposta non valida." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("accept_my_offer", { p_offer_id: parsed.data });
  refresh();
  after(dispatchSoon);
  if (error || !data) return toBookingError(error);
  return { ok: true, bookingId: data.id };
}

/** Rinuncia a un posto proposto. */
export async function declineMyOffer(offerId: string): Promise<BookingResult> {
  if (!(await requireRegisteredStudent())) return { ok: false, code: "not_allowed", message: "Sessione non valida. Accedi di nuovo." };
  const parsed = uuid.safeParse(offerId);
  if (!parsed.success) return { ok: false, code: "not_found", message: "Proposta non valida." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("decline_my_offer", { p_offer_id: parsed.data });
  refresh();
  after(dispatchSoon);
  return error ? toBookingError(error) : { ok: true };
}
