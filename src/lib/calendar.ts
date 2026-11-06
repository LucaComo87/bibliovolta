import { CALENDAR } from "./config";
import { parseDay } from "./dates";

/** Giornata come la vede l'interfaccia (corrisponde a get_day_availability). */
export type CalendarDay = {
  /** id della riga school_days (assente solo nei dati dimostrativi) */
  id?: string;
  day: string; // YYYY-MM-DD
  isOpen: boolean;
  capacity: number;
  /** posti occupati: prenotazioni confermate + posti proposti alla lista d'attesa */
  booked: number;
  /** prenotazioni confermate (se diverso da booked) */
  confirmed?: number;
  /** posti trattenuti da proposte della lista d'attesa in attesa di conferma */
  held?: number;
  /** studenti in lista d'attesa */
  waiting?: number;
  /** iscrizioni alla lista d'attesa possibili (giornata aperta, lista attiva, prima della soglia delle 24 ore) */
  waitlistOpen?: boolean;
  opensAt: string;
  closesAt: string;
  closureReason?: string | null;
  note?: string | null;
};

export type AvailabilityLevel = "available" | "limited" | "full" | "closed" | "past";

/** Soglia "QUASI COMPLETA": 5 posti liberi o meno. */
export const LIMITED_THRESHOLD = 5;

/** Etichette ufficiali degli stati della giornata. */
export const STATUS_LABEL: Record<AvailabilityLevel, string> = {
  available: "DISPONIBILE",
  limited: "QUASI COMPLETA",
  full: "COMPLETA",
  closed: "CHIUSA",
  past: "CONCLUSA",
};

export function availabilityLevel({
  booked,
  capacity,
  isOpen,
  isPast = false,
}: {
  booked: number;
  capacity: number;
  isOpen: boolean;
  isPast?: boolean;
}): AvailabilityLevel {
  if (isPast) return "past";
  if (!isOpen) return "closed";
  const free = capacity - booked;
  if (free <= 0) return "full";
  if (free <= LIMITED_THRESHOLD) return "limited";
  return "available";
}

export type MonthKey = { year: number; month: number }; // month 1–12

export function monthKeyOf(day: string): MonthKey {
  const [y, m] = day.split("-").map(Number);
  return { year: y, month: m };
}

export function monthId({ year, month }: MonthKey): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Mesi della stagione (da novembre 2026 a giugno 2027). */
export function seasonMonths(): MonthKey[] {
  const start = monthKeyOf(CALENDAR.seasonStart);
  const end = monthKeyOf(CALENDAR.seasonEnd);
  const months: MonthKey[] = [];
  let { year, month } = start;
  while (year < end.year || (year === end.year && month <= end.month)) {
    months.push({ year, month });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

export function isoDay(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isInSeason(day: string): boolean {
  return day >= CALENDAR.seasonStart && day <= CALENDAR.seasonEnd;
}

/** ISO: 1 = lunedì … 7 = domenica */
export function isoWeekday(day: string): number {
  const d = parseDay(day).getUTCDay();
  return d === 0 ? 7 : d;
}

/**
 * Griglia del mese con le sole colonne lunedì–venerdì
 * (il sabato e la domenica l'aula è chiusa: niente celle inutili).
 * Ogni settimana ha 5 celle; null = giorno fuori dal mese.
 */
export function monthGrid({ year, month }: MonthKey): (string | null)[][] {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const weeks: (string | null)[][] = [];
  let week: (string | null)[] = [null, null, null, null, null];
  let touched = false;

  for (let d = 1; d <= daysInMonth; d++) {
    const day = isoDay(year, month, d);
    const wd = isoWeekday(day);
    if (wd <= 5) {
      week[wd - 1] = day;
      touched = true;
    }
    if (wd === 7 || d === daysInMonth) {
      if (touched) weeks.push(week);
      week = [null, null, null, null, null];
      touched = false;
    }
  }
  return weeks;
}

export function addMonths({ year, month }: MonthKey, delta: number): MonthKey {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function sameMonth(a: MonthKey, b: MonthKey) {
  return a.year === b.year && a.month === b.month;
}
