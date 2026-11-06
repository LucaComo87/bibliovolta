import type { StudentWaitlistView } from "@/lib/bookings/types";
import type { OfferHistoryItem, WaitlistItem } from "@/components/student/views/StudentWaitlistView";

/** Iscrizioni attive (in attesa o con proposta aperta). */
export function activeWaitlist(rows: StudentWaitlistView[]): WaitlistItem[] {
  return rows
    .filter((w) => w.status === "waiting" || (w.status === "offered" && w.offer?.status === "pending"))
    .map((w) => ({
      id: w.id,
      day: w.day,
      position: w.position,
      status: w.status === "offered" ? "offered" : "waiting",
      offerExpiresAt: w.status === "offered" ? w.offer?.expiresAt : undefined,
      offerId: w.status === "offered" ? w.offer?.id : undefined,
      joinedAt: w.joinedAt,
      waitingTotal: w.waitingTotal,
      paused: w.paused,
    }));
}

/** Proposte ricevute e già concluse (confermate, scadute, rinunciate, annullate). */
export function offerHistory(rows: StudentWaitlistView[]): OfferHistoryItem[] {
  return rows
    .filter((w) => w.offer && w.offer.status !== "pending")
    .map((w) => ({ id: w.offer!.id, day: w.day, status: w.offer!.status as OfferHistoryItem["status"], offeredAt: w.offer!.offeredAt, reason: w.endReason }))
    .sort((a, b) => b.offeredAt.localeCompare(a.offeredAt));
}
