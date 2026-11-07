/** Tipi condivisi delle pagine docenti (dati reali dal database). */

export type RosterRow = {
  bookingId: string;
  studentId: string;
  firstName: string;
  lastName: string;
  className: string | null;
  email: string;
  bookedAt: string;
  source: "student" | "teacher" | "waitlist_offer";
};

export type CancelledRow = RosterRow & { cancelledAt: string; reason: string | null; byTeacher: boolean };

export type RosterWaitRow = { id: string; position: number | null; name: string; className: string | null; status: "waiting" | "offered"; joinedAt: string };

export type RosterDay = {
  id: string;
  day: string;
  capacity: number;
  opensAt: string;
  closesAt: string;
  isOpen: boolean;
  closureReason: string | null;
};

export type RosterData = {
  day: RosterDay | null;
  /** giornate selezionabili (tutta la stagione) con il numero di prenotati */
  days: { day: string; booked: number; isOpen: boolean }[];
  rows: RosterRow[];
  cancelled: CancelledRow[];
  waitlist: RosterWaitRow[];
  /** docenti di turno della giornata */
  supervisors: string[];
};

export type AnnouncementSummary = {
  id: string;
  title: string;
  body: string;
  day: string | null;
  author: string;
  publishedAt: string;
  includeBookings: boolean;
  includeWaitlist: boolean;
  recipients: number;
  sent: number;
  failed: number;
  pending: number;
  failures: { email: string; error: string | null }[];
};

export type ComposerDay = { id: string; day: string; booked: number; waiting: number; isOpen: boolean };

export type ActivityEntry = {
  id: number;
  at: string;
  actor: string;
  action: string;
  details: Record<string, unknown>;
};

export type DashboardData = {
  today: string;
  todayDay: { id: string; day: string; booked: number; capacity: number; isOpen: boolean; closureReason: string | null; opensAt: string; closesAt: string } | null;
  registeredStudents: number;
  fullDays: number;
  closedDays: number;
  waiting: number;
  upcoming: { id: string; day: string; booked: number; held: number; capacity: number; waiting: number; opensAt: string; closesAt: string }[];
  chart: { label: string; value: number }[];
  activity: ActivityEntry[];
};

/** Docente di turno in una giornata, come lo vede l'area docenti. */
export type ShiftView = { id: string; name: string; mine: boolean; registered: boolean };
/** Turni per giornata (chiave: data YYYY-MM-DD). */
export type ShiftMap = Record<string, ShiftView[]>;
/** Chi sta usando l'area docenti: serve per mostrare le azioni sui turni. */
export type ShiftViewer = { id: string; isAdmin: boolean; maxPerDay: number };
