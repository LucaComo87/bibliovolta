import type { OfferStatus, WaitlistStatus } from "@/lib/database.types";

export type WaitlistEntryView = {
  id: string;
  studentName: string;
  className: string | null;
  email: string;
  joinedAt: string;
  status: WaitlistStatus;
  position: number | null;
  endReason: string | null;
  offer: { status: OfferStatus; offeredAt: string; expiresAt: string } | null;
};

export type WaitlistDayView = {
  id: string;
  day: string;
  capacity: number;
  confirmed: number;
  held: number;
  waiting: number;
  isOpen: boolean;
  paused: boolean;
  waitlistOpen: boolean;
  opensAt: string;
  entries: WaitlistEntryView[];
};

export type OfferRowView = {
  id: string;
  day: string;
  studentName: string;
  className: string | null;
  status: OfferStatus;
  offeredAt: string;
  expiresAt: string;
  respondedAt: string | null;
  endReason: string | null;
};

export type WaitlistDashboardData = {
  offerMinutes: number;
  cancellationHours: number;
  totalWaiting: number;
  pendingOffers: OfferRowView[];
  expiredOffers: OfferRowView[];
  days: WaitlistDayView[];
};
