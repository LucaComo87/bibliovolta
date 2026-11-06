import "server-only";

import type { BookingErrorCode, BookingResult, StudentBookingView, StudentWaitlistView } from "@/lib/bookings/types";
import type { CalendarDay } from "@/lib/calendar";
import { CALENDAR } from "@/lib/config";
import { formatTime } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** Tutte le giornate della stagione con prenotazioni e posti liberi (solo conteggi). */
export async function getSeasonCalendar(supabase: Client): Promise<CalendarDay[]> {
  const { data, error } = await supabase.rpc("get_day_availability", { p_from: CALENDAR.seasonStart, p_to: CALENDAR.seasonEnd });
  if (error) throw new Error(`Calendario non disponibile: ${error.message}`);
  return (data ?? []).map((d) => ({
    id: d.school_day_id,
    day: d.day,
    isOpen: d.is_open,
    capacity: d.capacity,
    // posti occupati = prenotazioni confermate + posti proposti alla lista d'attesa
    booked: d.booked + d.held,
    confirmed: d.booked,
    held: d.held,
    waiting: d.waiting,
    waitlistOpen: d.waitlist_open,
    opensAt: formatTime(d.opens_at),
    closesAt: formatTime(d.closes_at),
    closureReason: d.closure_reason,
    note: d.note,
  }));
}

/** Prenotazioni dello studente collegato (la funzione legge solo le sue). */
export async function getMyBookings(supabase: Client): Promise<StudentBookingView[]> {
  const { data, error } = await supabase.rpc("my_bookings");
  if (error) throw new Error(`Prenotazioni non disponibili: ${error.message}`);
  return (data ?? []).map((b) => ({
    id: b.booking_id,
    day: b.day,
    status: b.status,
    createdAt: b.created_at,
    opensAt: formatTime(b.opens_at),
    closesAt: formatTime(b.closes_at),
    cancelDeadline: b.cancel_deadline,
  }));
}

/** Converte gli errori delle funzioni del database in messaggi per lo studente. */
export function toBookingError(error: { message?: string; hint?: string | null } | null): BookingResult {
  const hint = (error?.hint ?? "") as string;
  const known: Record<string, BookingErrorCode> = {
    capacity_reached: "capacity_reached",
    already_booked: "already_booked",
    day_closed: "day_closed",
    booking_closed: "booking_closed",
    cancel_deadline_passed: "cancel_deadline_passed",
    already_cancelled: "already_cancelled",
    day_not_found: "not_found",
    entry_not_found: "not_found",
    offer_not_found: "not_found",
    already_waiting: "already_waiting",
    seats_available: "seats_available",
    waitlist_closed: "waitlist_closed",
    waitlist_paused: "waitlist_paused",
    offer_pending: "offer_pending",
    offer_expired: "offer_expired",
    offer_not_valid: "offer_not_valid",
    offer_already_accepted: "offer_already_accepted",
    entry_not_active: "entry_not_active",
    not_teacher: "not_allowed",
    booking_not_found: "not_found",
    not_student: "not_allowed",
    not_registered: "not_allowed",
    not_authenticated: "not_allowed",
  };
  const code = known[hint] ?? "unknown";
  const message =
    code === "unknown" ? "Operazione non riuscita. Riprova tra qualche istante." : (error?.message ?? "").replace(/^BIBLIOVOLTA:\s*/, "");
  return { ok: false, code, message };
}

/** Liste d'attesa dello studente collegato, con posizione e proposte. */
export async function getMyWaitlist(supabase: Client): Promise<StudentWaitlistView[]> {
  const { data, error } = await supabase.rpc("my_waitlist");
  if (error) throw new Error(`Liste d'attesa non disponibili: ${error.message}`);
  return (data ?? []).map((w) => ({
    id: w.entry_id,
    day: w.day,
    schoolDayId: w.school_day_id,
    status: w.entry_status,
    joinedAt: w.joined_at,
    position: w.queue_position,
    waitingTotal: w.waiting_total,
    opensAt: formatTime(w.opens_at),
    closesAt: formatTime(w.closes_at),
    dayIsOpen: w.day_is_open,
    paused: w.waitlist_paused,
    offer: w.offer_id
      ? { id: w.offer_id, status: w.offer_status!, offeredAt: w.offered_at!, expiresAt: w.offer_expires_at! }
      : null,
    endReason: w.end_reason,
  }));
}
