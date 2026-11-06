import "server-only";

import { todayInRome } from "@/lib/dates";
import { formatTime } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { WaitlistDashboardData, WaitlistDayView, WaitlistEntryView, OfferRowView } from "./types";

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Dati della dashboard "Lista d'attesa" (solo docenti: le letture passano
 * dalla RLS, che concede queste tabelle ai docenti).
 */
export async function getWaitlistDashboard(supabase: Client): Promise<WaitlistDashboardData> {
  const today = todayInRome();
  const [{ data: settings }, { data: avail }] = await Promise.all([
    supabase.from("app_settings").select("offer_minutes, cancellation_hours").eq("id", 1).single(),
    supabase.rpc("get_day_availability", { p_from: today, p_to: "2100-01-01" }),
  ]);
  const days = avail ?? [];
  const dayIds = days.map((d) => d.school_day_id);

  const [{ data: entries }, { data: offers }, { data: dayRows }] = await Promise.all([
    dayIds.length
      ? supabase.from("waitlist_entries").select("id, school_day_id, student_id, status, joined_at, queue_seq, end_reason").in("school_day_id", dayIds).order("queue_seq")
      : Promise.resolve({ data: [] }),
    dayIds.length
      ? supabase.from("seat_offers").select("id, school_day_id, student_id, waitlist_entry_id, status, offered_at, expires_at, responded_at, end_reason").in("school_day_id", dayIds).order("offered_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    dayIds.length ? supabase.from("school_days").select("id, waitlist_paused").in("id", dayIds) : Promise.resolve({ data: [] }),
  ]);

  const studentIds = [...new Set([...(entries ?? []).map((e) => e.student_id), ...(offers ?? []).map((o) => o.student_id)])];
  const { data: students } = studentIds.length
    ? await supabase.from("students").select("id, first_name, last_name, full_name, class_name, email").in("id", studentIds)
    : { data: [] as { id: string; first_name: string | null; last_name: string | null; full_name: string; class_name: string | null; email: string }[] };
  const who = new Map((students ?? []).map((s) => [s.id, s]));
  const nameOf = (id: string) => {
    const s = who.get(id);
    return s ? `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || s.full_name || s.email : "Studente";
  };
  const paused = new Map((dayRows ?? []).map((d) => [d.id, d.waitlist_paused]));
  const latestOffer = new Map<string, NonNullable<typeof offers>[number]>();
  for (const o of offers ?? []) if (!latestOffer.has(o.waitlist_entry_id)) latestOffer.set(o.waitlist_entry_id, o);

  const byDay = new Map<string, WaitlistEntryView[]>();
  const positions = new Map<string, number>();
  for (const e of entries ?? []) {
    let position: number | null = null;
    if (e.status === "waiting") {
      position = (positions.get(e.school_day_id) ?? 0) + 1;
      positions.set(e.school_day_id, position);
    }
    const o = latestOffer.get(e.id);
    const list = byDay.get(e.school_day_id) ?? [];
    list.push({
      id: e.id,
      studentName: nameOf(e.student_id),
      className: who.get(e.student_id)?.class_name ?? null,
      email: who.get(e.student_id)?.email ?? "",
      joinedAt: e.joined_at,
      status: e.status,
      position,
      endReason: e.end_reason,
      offer: o ? { status: o.status, offeredAt: o.offered_at, expiresAt: o.expires_at } : null,
    });
    byDay.set(e.school_day_id, list);
  }

  const dayViews: WaitlistDayView[] = days
    .filter((d) => byDay.has(d.school_day_id))
    .map((d) => ({
      id: d.school_day_id,
      day: d.day,
      capacity: d.capacity,
      confirmed: d.booked,
      held: d.held,
      waiting: d.waiting,
      isOpen: d.is_open,
      paused: paused.get(d.school_day_id) ?? false,
      waitlistOpen: d.waitlist_open,
      opensAt: formatTime(d.opens_at),
      entries: byDay.get(d.school_day_id)!,
    }));

  const dayOf = new Map(days.map((d) => [d.school_day_id, d.day]));
  const toOffer = (o: NonNullable<typeof offers>[number]): OfferRowView => ({
    id: o.id,
    day: dayOf.get(o.school_day_id) ?? "",
    studentName: nameOf(o.student_id),
    className: who.get(o.student_id)?.class_name ?? null,
    status: o.status,
    offeredAt: o.offered_at,
    expiresAt: o.expires_at,
    respondedAt: o.responded_at,
    endReason: o.end_reason,
  });

  return {
    offerMinutes: settings?.offer_minutes ?? 120,
    cancellationHours: settings?.cancellation_hours ?? 24,
    totalWaiting: days.reduce((s, d) => s + d.waiting, 0),
    pendingOffers: (offers ?? []).filter((o) => o.status === "pending").map(toOffer).sort((a, b) => a.expiresAt.localeCompare(b.expiresAt)),
    expiredOffers: (offers ?? []).filter((o) => o.status === "expired").map(toOffer).slice(0, 30),
    days: dayViews,
  };
}
