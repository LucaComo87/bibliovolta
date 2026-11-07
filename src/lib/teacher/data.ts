import "server-only";

import { CALENDAR } from "@/lib/config";
import { formatTime, todayInRome } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  ActivityEntry,
  AnnouncementSummary,
  ComposerDay,
  DashboardData,
  RosterData,
  RosterRow,
} from "./types";

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function season(supabase: Client) {
  const { data, error } = await supabase.rpc("get_day_availability", { p_from: CALENDAR.seasonStart, p_to: "2100-01-01" });
  if (error) throw new Error(error.message);
  return data ?? [];
}

const shortDay = (day: string) =>
  new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));

/** Registro leggibile delle operazioni dei docenti (voci "docente.*"). */
export async function getActivityLog(supabase: Client, limit = 200): Promise<ActivityEntry[]> {
  const { data } = await supabase
    .from("audit_log")
    .select("id, occurred_at, actor_id, action, details")
    .like("action", "docente.%")
    .order("occurred_at", { ascending: false })
    .limit(limit);
  const actorIds = [...new Set((data ?? []).map((r) => r.actor_id).filter(Boolean))] as string[];
  const { data: teachers } = actorIds.length ? await supabase.from("teachers").select("id, full_name, email").in("id", actorIds) : { data: [] };
  const names = new Map((teachers ?? []).map((t) => [t.id, t.full_name || t.email]));
  return (data ?? []).map((r) => ({
    id: r.id,
    at: r.occurred_at,
    actor: (r.actor_id && names.get(r.actor_id)) || "Sistema",
    action: r.action.replace(/^docente\./, ""),
    details: (r.details ?? {}) as Record<string, unknown>,
  }));
}

export async function getDashboardData(supabase: Client): Promise<DashboardData> {
  const today = todayInRome();
  const [days, { count: students }, activity] = await Promise.all([
    season(supabase),
    supabase.from("students").select("id", { count: "exact", head: true }).not("registered_at", "is", null).eq("is_active", true),
    getActivityLog(supabase, 6),
  ]);
  const t = days.find((d) => d.day === today);
  const future = days.filter((d) => d.day >= today);
  const upcomingOpen = future.filter((d) => d.is_open);
  return {
    today,
    todayDay: t
      ? { id: t.school_day_id, day: t.day, booked: t.booked, capacity: t.capacity, isOpen: t.is_open, closureReason: t.closure_reason, opensAt: formatTime(t.opens_at), closesAt: formatTime(t.closes_at) }
      : null,
    registeredStudents: students ?? 0,
    fullDays: upcomingOpen.filter((d) => d.booked + d.held >= d.capacity).length,
    closedDays: days.filter((d) => !d.is_open && d.day >= CALENDAR.seasonStart && d.day <= CALENDAR.seasonEnd).length,
    waiting: future.reduce((s, d) => s + d.waiting, 0),
    upcoming: upcomingOpen.slice(0, 10).map((d) => ({
      id: d.school_day_id, day: d.day, booked: d.booked, held: d.held, capacity: d.capacity, waiting: d.waiting,
      opensAt: formatTime(d.opens_at), closesAt: formatTime(d.closes_at),
    })),
    chart: upcomingOpen.slice(0, 10).map((d) => ({ label: shortDay(d.day), value: Math.round(((d.booked + d.held) / d.capacity) * 100) })),
    activity,
  };
}

/** Elenco degli iscritti di una giornata (prenotati, annullati, lista d'attesa). */
export async function getRoster(supabase: Client, requestedDay: string | null): Promise<RosterData> {
  const days = await season(supabase);
  const today = todayInRome();
  const valid = requestedDay && days.some((d) => d.day === requestedDay) ? requestedDay : null;
  const chosen =
    valid ??
    days.find((d) => d.day >= today && d.is_open && d.booked > 0)?.day ??
    days.find((d) => d.day >= today && d.is_open)?.day ??
    days[0]?.day ??
    null;
  const list = days.map((d) => ({ day: d.day, booked: d.booked, isOpen: d.is_open }));
  if (!chosen) return { day: null, days: list, rows: [], cancelled: [], waitlist: [], supervisors: [] };

  const { data: dayRow } = await supabase.from("school_days").select("id, day, capacity, opens_at, closes_at, is_open, closure_reason").eq("day", chosen).single();
  if (!dayRow) return { day: null, days: list, rows: [], cancelled: [], waitlist: [], supervisors: [] };

  const [{ data: bookings }, { data: waits }, { data: shiftRows }] = await Promise.all([
    supabase.from("bookings").select("id, student_id, status, source, created_at, cancelled_at, cancelled_by, cancel_reason").eq("school_day_id", dayRow.id).order("created_at"),
    supabase.from("waitlist_entries").select("id, student_id, status, joined_at, queue_seq").eq("school_day_id", dayRow.id).in("status", ["waiting", "offered"]).order("queue_seq"),
    supabase.from("supervision_shifts").select("teacher_name").eq("school_day_id", dayRow.id).order("created_at"),
  ]);
  const ids = [...new Set([...(bookings ?? []).map((b) => b.student_id), ...(waits ?? []).map((w) => w.student_id)])];
  const { data: students } = ids.length
    ? await supabase.from("students").select("id, first_name, last_name, full_name, class_name, email").in("id", ids)
    : { data: [] as { id: string; first_name: string | null; last_name: string | null; full_name: string; class_name: string | null; email: string }[] };
  const who = new Map((students ?? []).map((s) => [s.id, s]));
  const toRow = (b: NonNullable<typeof bookings>[number]): RosterRow => {
    const s = who.get(b.student_id);
    return {
      bookingId: b.id,
      studentId: b.student_id,
      firstName: s?.first_name ?? s?.full_name ?? "",
      lastName: s?.last_name ?? "",
      className: s?.class_name ?? null,
      email: s?.email ?? "",
      bookedAt: b.created_at,
      source: b.source,
    };
  };
  let position = 0;
  return {
    day: {
      id: dayRow.id, day: dayRow.day, capacity: dayRow.capacity, opensAt: formatTime(dayRow.opens_at), closesAt: formatTime(dayRow.closes_at),
      isOpen: dayRow.is_open, closureReason: dayRow.closure_reason,
    },
    days: list,
    supervisors: (shiftRows ?? []).map((r) => r.teacher_name),
    rows: (bookings ?? []).filter((b) => b.status === "confirmed").map(toRow),
    cancelled: (bookings ?? [])
      .filter((b) => b.status === "cancelled")
      .map((b) => ({ ...toRow(b), cancelledAt: b.cancelled_at ?? b.created_at, reason: b.cancel_reason, byTeacher: Boolean(b.cancelled_by && b.cancelled_by !== b.student_id) })),
    waitlist: (waits ?? []).map((w) => {
      const s = who.get(w.student_id);
      return {
        id: w.id,
        position: w.status === "waiting" ? ++position : null,
        name: `${s?.first_name ?? ""} ${s?.last_name ?? ""}`.trim() || s?.email || "",
        className: s?.class_name ?? null,
        status: w.status as "waiting" | "offered",
        joinedAt: w.joined_at,
      };
    }),
  };
}

/** Giornate selezionabili per una comunicazione: da oggi in poi. */
export async function getComposerDays(supabase: Client): Promise<ComposerDay[]> {
  const today = todayInRome();
  return (await season(supabase))
    .filter((d) => d.day >= today)
    .map((d) => ({ id: d.school_day_id, day: d.day, booked: d.booked, waiting: d.waiting, isOpen: d.is_open }));
}

/** Storico delle comunicazioni con l'esito di ogni invio. */
export async function getAnnouncements(supabase: Client, limit = 30): Promise<AnnouncementSummary[]> {
  const { data: anns } = await supabase
    .from("announcements")
    .select("id, title, body, school_day_id, author_id, published_at, include_bookings, include_waitlist, recipients_count")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (!anns?.length) return [];
  const annIds = anns.map((a) => a.id);
  const dayIds = [...new Set(anns.map((a) => a.school_day_id).filter(Boolean))] as string[];
  const authorIds = [...new Set(anns.map((a) => a.author_id).filter(Boolean))] as string[];
  const [{ data: deliveries }, { data: days }, { data: authors }] = await Promise.all([
    supabase.from("announcement_deliveries").select("announcement_id, student_id, email_status, email_error").in("announcement_id", annIds),
    dayIds.length ? supabase.from("school_days").select("id, day").in("id", dayIds) : Promise.resolve({ data: [] }),
    authorIds.length ? supabase.from("teachers").select("id, full_name, email").in("id", authorIds) : Promise.resolve({ data: [] }),
  ]);
  const failedIds = [...new Set((deliveries ?? []).filter((d) => d.email_status === "failed").map((d) => d.student_id))];
  const { data: failedStudents } = failedIds.length ? await supabase.from("students").select("id, email").in("id", failedIds) : { data: [] };
  const emailOf = new Map((failedStudents ?? []).map((s) => [s.id, s.email]));
  const dayOf = new Map((days ?? []).map((d) => [d.id, d.day]));
  const authorOf = new Map((authors ?? []).map((t) => [t.id, t.full_name || t.email]));
  return anns.map((a) => {
    const ds = (deliveries ?? []).filter((d) => d.announcement_id === a.id);
    return {
      id: a.id,
      title: a.title,
      body: a.body,
      day: a.school_day_id ? dayOf.get(a.school_day_id) ?? null : null,
      author: (a.author_id && authorOf.get(a.author_id)) || "Docente",
      publishedAt: a.published_at!,
      includeBookings: a.include_bookings,
      includeWaitlist: a.include_waitlist,
      recipients: a.recipients_count || ds.length,
      sent: ds.filter((d) => d.email_status === "sent").length,
      failed: ds.filter((d) => d.email_status === "failed").length,
      pending: ds.filter((d) => d.email_status === "pending").length,
      failures: ds.filter((d) => d.email_status === "failed").map((d) => ({ email: emailOf.get(d.student_id) ?? "", error: d.email_error })),
    };
  });
}
