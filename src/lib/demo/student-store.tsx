"use client";

/**
 * Stato dell'anteprima studente (SOLO DATI DIMOSTRATIVI).
 * Le azioni modificano una copia in memoria nel browser per far provare
 * l'interfaccia: nulla viene inviato al server o salvato nel database.
 * Nella Fase 4 queste azioni saranno sostituite dalle chiamate RPC reali.
 */
import { createContext, use, useCallback, useMemo, useState, type ReactNode } from "react";
import { DEMO_BOOKINGS, DEMO_TODAY, DEMO_WAITLIST, demoDays, type DemoBooking, type DemoWaitlist } from "./data";
import type { CalendarDay } from "@/lib/calendar";

type Toast = { id: number; title: string; body?: string };

type Store = {
  today: string;
  now: Date;
  days: CalendarDay[];
  bookings: DemoBooking[];
  waitlist: DemoWaitlist[];
  toast: Toast | null;
  book: (day: string) => void;
  cancel: (bookingId: string) => void;
  joinWaitlist: (day: string) => void;
  leaveWaitlist: (id: string) => void;
  acceptOffer: (id: string) => void;
  declineOffer: (id: string) => void;
  dismissToast: () => void;
};

const Ctx = createContext<Store | null>(null);

export function DemoStudentProvider({ children }: { children: ReactNode }) {
  const [days, setDays] = useState<CalendarDay[]>(() => demoDays());
  const [bookings, setBookings] = useState<DemoBooking[]>(DEMO_BOOKINGS);
  const [waitlist, setWaitlist] = useState<DemoWaitlist[]>(DEMO_WAITLIST);
  const [toast, setToast] = useState<Toast | null>(null);
  const now = useMemo(() => new Date(`${DEMO_TODAY}T09:00:00Z`), []);

  const notify = useCallback((title: string, body?: string) => {
    const t = { id: Date.now(), title, body: body ?? "Anteprima: nessun dato è stato salvato." };
    setToast(t);
    setTimeout(() => setToast((cur) => (cur?.id === t.id ? null : cur)), 4000);
  }, []);

  const shift = useCallback((day: string, delta: number) => {
    setDays((ds) => ds.map((d) => (d.day === day ? { ...d, booked: Math.max(0, d.booked + delta) } : d)));
  }, []);

  const store: Store = {
    today: DEMO_TODAY,
    now,
    days,
    bookings,
    waitlist,
    toast,
    book(day) {
      setBookings((bs) => [...bs, { id: `n${Date.now()}`, day, status: "confirmed", createdAt: now.toISOString() }]);
      shift(day, 1);
      notify("Posto prenotato");
    },
    cancel(id) {
      const b = bookings.find((x) => x.id === id);
      if (!b) return;
      setBookings((bs) => bs.map((x) => (x.id === id ? { ...x, status: "cancelled" } : x)));
      shift(b.day, -1);
      notify("Prenotazione annullata");
    },
    joinWaitlist(day) {
      const position = 1 + Math.floor(Math.random() * 5);
      setWaitlist((ws) => [...ws, { id: `w${Date.now()}`, day, position, status: "waiting" }]);
      notify("Sei in lista d'attesa", `Posizione ${position}. Anteprima: nessun dato è stato salvato.`);
    },
    leaveWaitlist(id) {
      setWaitlist((ws) => ws.filter((w) => w.id !== id));
      notify("Sei uscito dalla lista d'attesa");
    },
    acceptOffer(id) {
      const w = waitlist.find((x) => x.id === id);
      if (!w) return;
      setWaitlist((ws) => ws.filter((x) => x.id !== id));
      setBookings((bs) => [...bs, { id: `o${Date.now()}`, day: w.day, status: "confirmed", createdAt: now.toISOString() }]);
      notify("Posto confermato", "Hai accettato la proposta. Anteprima: nessun dato è stato salvato.");
    },
    declineOffer(id) {
      setWaitlist((ws) => ws.filter((x) => x.id !== id));
      notify("Proposta rifiutata", "Il posto passa al successivo in lista. Anteprima: nessun dato è stato salvato.");
    },
    dismissToast: () => setToast(null),
  };

  return <Ctx value={store}>{children}</Ctx>;
}

export function useDemoStudent(): Store {
  const s = use(Ctx);
  if (!s) throw new Error("useDemoStudent va usato dentro DemoStudentProvider");
  return s;
}
