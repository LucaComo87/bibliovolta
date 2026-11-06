/** Esito di un'operazione sulle prenotazioni, restituito dalle Server Actions. */
export type BookingResult =
  | { ok: true; bookingId?: string }
  | { ok: false; code: BookingErrorCode; message: string };

export type BookingErrorCode =
  | "capacity_reached"
  | "already_booked"
  | "day_closed"
  | "booking_closed"
  | "cancel_deadline_passed"
  | "already_cancelled"
  | "not_found"
  | "not_allowed"
  | "already_waiting"
  | "seats_available"
  | "waitlist_closed"
  | "waitlist_paused"
  | "offer_pending"
  | "offer_expired"
  | "offer_not_valid"
  | "offer_already_accepted"
  | "entry_not_active"
  | "unknown";

/** Prenotazione come la vede lo studente (da my_bookings). */
export type StudentBookingView = {
  id: string;
  day: string;
  status: "confirmed" | "cancelled" | "attended";
  createdAt: string;
  opensAt?: string;
  closesAt?: string;
  /** ISO, calcolato dal database in Europe/Rome */
  cancelDeadline?: string;
};

/** Iscrizione alla lista d'attesa come la vede lo studente (da my_waitlist). */
export type StudentWaitlistView = {
  id: string;
  day: string;
  schoolDayId: string;
  status: "waiting" | "offered" | "assigned" | "expired" | "withdrawn";
  joinedAt: string;
  position: number | null;
  waitingTotal: number;
  opensAt: string;
  closesAt: string;
  dayIsOpen: boolean;
  paused: boolean;
  offer: null | {
    id: string;
    status: "pending" | "accepted" | "declined" | "expired" | "revoked";
    offeredAt: string;
    expiresAt: string;
  };
  endReason: string | null;
};
