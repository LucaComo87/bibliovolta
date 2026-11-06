/**
 * DATI DIMOSTRATIVI — SOLO PER L'ANTEPRIMA DELL'INTERFACCIA (Fase 2)
 *
 * Nomi, prenotazioni e numeri qui sotto sono inventati e servono solo a
 * mostrare le schermate in /anteprima. Non vengono mai scritti nel
 * database e non sono usati dalle pagine reali (/studente, /docenti).
 * Le chiusure qui elencate sono esempi: le festività reali le
 * configurano i docenti.
 */
import { CALENDAR } from "@/lib/config";
import type { CalendarDay } from "@/lib/calendar";
import { isoWeekday } from "@/lib/calendar";

/** Data "di oggi" simulata nell'anteprima, per mostrare giornate passate e future. */
export const DEMO_TODAY = "2026-11-23";

const DEMO_CLOSURES: Record<string, string> = {
  "2026-12-07": "Ponte dell'Immacolata (esempio)",
  "2026-12-08": "Immacolata Concezione",
};
const DEMO_CLOSED_RANGES: { from: string; to: string; reason: string }[] = [
  { from: "2026-12-23", to: "2027-01-06", reason: "Vacanze di Natale (esempio)" },
  { from: "2027-03-25", to: "2027-03-30", reason: "Vacanze di Pasqua (esempio)" },
];

/** Generatore pseudo-casuale deterministico: stessi numeri a ogni rendering. */
function seeded(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function closureFor(day: string): string | null {
  if (DEMO_CLOSURES[day]) return DEMO_CLOSURES[day];
  const range = DEMO_CLOSED_RANGES.find((r) => day >= r.from && day <= r.to);
  return range?.reason ?? null;
}

let cachedDays: CalendarDay[] | null = null;

/** Tutte le giornate feriali della stagione con occupazione inventata. */
export function demoDays(): CalendarDay[] {
  if (cachedDays) return cachedDays;
  const days: CalendarDay[] = [];
  const start = new Date(`${CALENDAR.seasonStart}T12:00:00Z`);
  const end = new Date(`${CALENDAR.seasonEnd}T12:00:00Z`);
  for (let d = start; d <= end; d = new Date(d.getTime() + 86400000)) {
    const day = d.toISOString().slice(0, 10);
    if (isoWeekday(day) > 5) continue;
    const closure = closureFor(day);
    const wd = isoWeekday(day);
    const r = seeded(day);
    // più richieste a inizio settimana e vicino alle verifiche
    const base = wd <= 3 ? 28 : 18;
    const near = day < "2026-12-12" ? 1 : 0.65;
    let booked = Math.round((base + r * 18) * near);
    if (["2026-11-25", "2026-12-02", "2026-12-09"].includes(day)) booked = 50; // giornate complete
    if (day === "2026-11-24") booked = 44;
    days.push({
      day,
      isOpen: !closure,
      capacity: CALENDAR.capacity,
      booked: closure ? 0 : Math.min(booked, CALENDAR.capacity),
      opensAt: CALENDAR.opensAt,
      closesAt: CALENDAR.closesAt,
      closureReason: closure,
      note: day === "2026-11-27" ? "Uscita anticipata alle 16:00 per assemblea (esempio)" : null,
    });
  }
  cachedDays = days;
  return days;
}

export function demoDay(day: string): CalendarDay | undefined {
  return demoDays().find((d) => d.day === day);
}

// ---------------------------------------------------------------------
// Studente dimostrativo
// ---------------------------------------------------------------------
export const DEMO_STUDENT = {
  fullName: "Giulia Esempio",
  firstName: "Giulia",
  email: "giulia.esempio@stud.liceovoltacomo.edu.it",
  className: "4B",
};

export type DemoBooking = {
  id: string;
  day: string;
  status: "confirmed" | "cancelled" | "attended";
  createdAt: string;
};

export const DEMO_BOOKINGS: DemoBooking[] = [
  { id: "b1", day: "2026-11-24", status: "confirmed", createdAt: "2026-11-19T18:02:00Z" },
  { id: "b2", day: "2026-11-26", status: "confirmed", createdAt: "2026-11-20T07:45:00Z" },
  { id: "b3", day: "2026-12-01", status: "confirmed", createdAt: "2026-11-22T16:10:00Z" },
  { id: "b4", day: "2026-11-20", status: "attended", createdAt: "2026-11-16T12:30:00Z" },
  { id: "b5", day: "2026-11-18", status: "attended", createdAt: "2026-11-16T12:31:00Z" },
  { id: "b6", day: "2026-11-17", status: "cancelled", createdAt: "2026-11-16T12:29:00Z" },
];

export type DemoWaitlist = {
  id: string;
  day: string;
  position: number;
  status: "waiting" | "offered";
  offerExpiresAt?: string;
  offerId?: string;
};

export const DEMO_WAITLIST: DemoWaitlist[] = [
  { id: "w1", day: "2026-11-25", position: 1, status: "offered", offerExpiresAt: "2026-11-23T20:00:00Z", offerId: "w1" },
  { id: "w2", day: "2026-12-02", position: 4, status: "waiting" },
];

export type DemoAnnouncement = {
  id: string;
  title: string;
  body: string;
  author: string;
  publishedAt: string;
  audience: "all_students" | "day_bookings" | "single_student";
  day?: string;
  recipients: number;
  emailSent: number;
  read: number;
};

export const DEMO_ANNOUNCEMENTS: DemoAnnouncement[] = [
  {
    id: "a1",
    title: "Uscita anticipata venerdì 27 novembre",
    body: "Per l'assemblea d'istituto l'aula studio chiuderà alle 16:00. Le prenotazioni restano valide.",
    author: "Prof.ssa Anna Esempio",
    publishedAt: "2026-11-21T10:15:00Z",
    audience: "day_bookings",
    day: "2026-11-27",
    recipients: 38,
    emailSent: 38,
    read: 31,
  },
  {
    id: "a2",
    title: "Ricorda di annullare se non puoi venire",
    body: "Annullando entro 24 ore libererai il posto per chi è in lista d'attesa. Grazie per la collaborazione!",
    author: "Prof. Marco Esempio",
    publishedAt: "2026-11-18T08:00:00Z",
    audience: "all_students",
    recipients: 412,
    emailSent: 412,
    read: 266,
  },
  {
    id: "a3",
    title: "Benvenuti in BIBLIOVOLTA",
    body: "Da lunedì 16 novembre l'aula studio è aperta dal lunedì al venerdì, dalle 14:15 alle 16:30.",
    author: "Prof.ssa Anna Esempio",
    publishedAt: "2026-11-12T09:30:00Z",
    audience: "all_students",
    recipients: 389,
    emailSent: 389,
    read: 301,
  },
];

// ---------------------------------------------------------------------
// Docente dimostrativo, iscritti, statistiche
// ---------------------------------------------------------------------
export const DEMO_TEACHER = {
  fullName: "Anna Esempio",
  title: "Prof.ssa",
  email: "anna.esempio@liceovoltacomo.edu.it",
  isAdmin: true,
};

const FIRST = ["Alessandro", "Beatrice", "Carlo", "Chiara", "Davide", "Elena", "Federico", "Francesca", "Gabriele", "Giorgia", "Leonardo", "Lucia", "Matteo", "Martina", "Nicolò", "Sara", "Pietro", "Sofia", "Riccardo", "Viola", "Tommaso", "Alice", "Edoardo", "Emma", "Filippo"];
const LAST = ["Esempio", "Prova", "Demo", "Campione", "Modello"];
const CLASSES = ["1A", "2C", "3A", "3B", "4A", "4B", "4C", "5A", "5B", "5D"];

export type DemoRosterRow = {
  id: string;
  name: string;
  email: string;
  className: string;
  bookedAt: string;
  status: "confirmed" | "cancelled";
};

/** Iscritti inventati per una giornata. */
export function demoRoster(day: string, count?: number): DemoRosterRow[] {
  const d = demoDay(day);
  const n = count ?? d?.booked ?? 0;
  return Array.from({ length: n }, (_, i) => {
    const first = FIRST[Math.floor(seeded(`${day}f${i}`) * FIRST.length)];
    const last = LAST[i % LAST.length];
    const hour = 7 + Math.floor(seeded(`${day}h${i}`) * 14);
    const min = Math.floor(seeded(`${day}m${i}`) * 60);
    return {
      id: `${day}-${i}`,
      name: `${first} ${last}`,
      email: `${first}.${last}${i}`.toLowerCase().replace(/[^a-z0-9.]/g, "") + "@stud.liceovoltacomo.edu.it",
      className: CLASSES[Math.floor(seeded(`${day}c${i}`) * CLASSES.length)],
      bookedAt: `2026-11-${String(16 + (i % 6)).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00Z`,
      status: (seeded(`${day}s${i}`) > 0.93 ? "cancelled" : "confirmed") as DemoRosterRow["status"],
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "it"));
}

export function demoWaitlistFor(day: string) {
  const d = demoDay(day);
  if (!d || d.booked < d.capacity) return [];
  return Array.from({ length: 6 }, (_, i) => ({
    id: `${day}-w${i}`,
    position: i + 1,
    name: `${FIRST[(i * 7) % FIRST.length]} ${LAST[(i + 2) % LAST.length]}`,
    className: CLASSES[(i * 3) % CLASSES.length],
    status: i === 0 ? ("offered" as const) : ("waiting" as const),
  }));
}

export const DEMO_STATS = {
  totalBookings: 1286,
  uniqueStudents: 412,
  avgOccupancy: 71,
  cancellations: 94,
  noShowRate: 4,
  weeks: [
    { label: "16 nov", value: 78 },
    { label: "23 nov", value: 84 },
    { label: "30 nov", value: 76 },
    { label: "7 dic", value: 62 },
    { label: "14 dic", value: 69 },
    { label: "21 dic", value: 41 },
  ],
  weekdays: [
    { label: "Lun", value: 86 },
    { label: "Mar", value: 82 },
    { label: "Mer", value: 77 },
    { label: "Gio", value: 61 },
    { label: "Ven", value: 48 },
  ],
  classes: [
    { label: "5A", value: 182 },
    { label: "4B", value: 164 },
    { label: "5B", value: 151 },
    { label: "4A", value: 133 },
    { label: "3B", value: 118 },
    { label: "4C", value: 97 },
  ],
};

// ---------------------------------------------------------------------
// Fase 6 · dashboard docenti dimostrativa (solo anteprima)
// ---------------------------------------------------------------------
export const DEMO_STATS_V6 = {
  totalBookings: DEMO_STATS.totalBookings,
  avgDaily: 35.7,
  avgOccupancy: DEMO_STATS.avgOccupancy,
  waiting: 9,
  fullDays: 3,
  uniqueStudents: DEMO_STATS.uniqueStudents,
  registeredStudents: 468,
  cancellations: DEMO_STATS.cancellations,
  referenceDays: 36,
  weeks: DEMO_STATS.weeks,
  weekdays: DEMO_STATS.weekdays,
  topDays: [
    { label: "mer 25 nov", value: 50 },
    { label: "mer 2 dic", value: 50 },
    { label: "mer 9 dic", value: 50 },
    { label: "mar 24 nov", value: 44 },
    { label: "lun 30 nov", value: 43 },
  ],
  classes: DEMO_STATS.classes,
};

export const DEMO_ACTIVITY = [
  { id: 6, at: "2026-11-23T08:12:00Z", actor: "Prof.ssa Anna Esempio", action: "prenotazione_annullata", details: { day: "2026-11-25", studente: "Mario Esempio", classe: "4B", motivo: "Uscita didattica della classe (esempio)", email: true } },
  { id: 5, at: "2026-11-21T10:15:00Z", actor: "Prof.ssa Anna Esempio", action: "comunicazione_inviata", details: { day: "2026-11-27", subject: "Uscita anticipata alle 16:00", recipients: 38, prenotati: true, lista_attesa: false } },
  { id: 4, at: "2026-11-20T15:40:00Z", actor: "Prof. Marco Esempio", action: "giornata_chiusa", details: { day: "2026-12-07", motivo: "Ponte dell'Immacolata (esempio)", prenotati: 12, in_attesa: 0, comunicazione: "default", destinatari: 12 } },
  { id: 3, at: "2026-11-20T15:31:00Z", actor: "Prof. Marco Esempio", action: "orario_giornata", details: { day: "2026-11-27", orario: { da: "14:15–16:30", a: "14:15–16:00" } } },
  { id: 2, at: "2026-11-18T09:02:00Z", actor: "Prof.ssa Anna Esempio", action: "impostazioni", details: { impostazione: "tempo di conferma della lista d'attesa", da: 120, a: 90 } },
  { id: 1, at: "2026-11-16T07:45:00Z", actor: "Prof.ssa Anna Esempio", action: "orario_generale", details: { da: "14:00–16:30", a: "14:15–16:30", giornate: 141 } },
];
