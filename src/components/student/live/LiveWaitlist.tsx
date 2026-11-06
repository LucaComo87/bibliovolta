"use client";

import { acceptMyOffer, declineMyOffer, leaveWaitlist } from "@/app/studente/actions";
import { StudentWaitlistView, type OfferHistoryItem, type WaitlistItem } from "@/components/student/views/StudentWaitlistView";
import { useLiveClock } from "./useLiveClock";

export function LiveWaitlist({
  base,
  nowIso,
  waitlist,
  history,
  offerMinutes,
}: {
  base: string;
  nowIso: string;
  waitlist: WaitlistItem[];
  history: OfferHistoryItem[];
  offerMinutes: number;
}) {
  useLiveClock(nowIso); // posizioni e proposte aggiornate ogni 30 secondi
  return (
    <StudentWaitlistView
      base={base}
      waitlist={waitlist}
      history={history}
      offerMinutes={offerMinutes}
      onLeave={leaveWaitlist}
      onAccept={acceptMyOffer}
      onDecline={declineMyOffer}
    />
  );
}
