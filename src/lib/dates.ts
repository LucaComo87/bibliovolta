import { CALENDAR } from "./config";

/** Interpreta "YYYY-MM-DD" come data di calendario (mezzogiorno UTC, nessun salto di fuso). */
export function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

export function formatDayLong(day: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: CALENDAR.timezone,
  }).format(parseDay(day));
}

export function formatDayShort(day: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    timeZone: CALENDAR.timezone,
  }).format(parseDay(day));
}

/** Data odierna nel fuso della scuola, formato YYYY-MM-DD. */
export function todayInRome(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: CALENDAR.timezone }).format(now);
}

/** Orario "14:15:00" → "14:15". */
export function formatTime(time: string): string {
  return time.slice(0, 5);
}

export function formatMonth({ year, month }: { year: number; month: number }): string {
  return new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 15)),
  );
}

export function formatWeekdayShort(day: string): string {
  return new Intl.DateTimeFormat("it-IT", { weekday: "short", timeZone: CALENDAR.timezone }).format(parseDay(day));
}

export function formatDayMedium(day: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: CALENDAR.timezone,
  }).format(parseDay(day));
}

export function dayOfMonth(day: string): number {
  return Number(day.slice(8, 10));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CALENDAR.timezone,
  }).format(new Date(iso));
}

export const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven"] as const;
