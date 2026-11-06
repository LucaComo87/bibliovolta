import { CALENDAR } from "./config";

/** Converte una data/ora "di parete" nel fuso della scuola in un istante UTC. */
export function romeToUtc(day: string, time: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CALENDAR.timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asRome = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess - (asRome - guess));
}

/** Momento entro cui una prenotazione può essere annullata (24 ore prima dell'apertura). */
export function cancellationDeadline(day: string, opensAt: string = CALENDAR.opensAt, hours: number = CALENDAR.cancellationHours): Date {
  return new Date(romeToUtc(day, opensAt).getTime() - hours * 3600_000);
}

export function canCancel(day: string, now: Date, opensAt?: string): boolean {
  return now.getTime() < cancellationDeadline(day, opensAt).getTime();
}

export function formatDeadline(date: Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CALENDAR.timezone,
  }).format(date);
}
