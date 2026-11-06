import { CalendarClock, CircleCheck, CircleX, Clock3, Hourglass } from "lucide-react";
import { AppCredit } from "@/components/layout/AppCredit";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { AreaLoading } from "@/components/auth/AreaLoading";
import { SchoolLogo } from "@/components/brand/SchoolLogo";
import { LibraryBackdrop } from "@/components/media/LibraryPhoto";
import { ButtonLink } from "@/components/ui/Button";
import { OfferResponse } from "@/components/waitlist/OfferResponse";
import { ROUTES } from "@/lib/config";
import { formatDayMedium, formatTime } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Posto disponibile", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** Pagina del link personale ricevuto via email. */
export default function OfferPage({ params }: PageProps<"/proposta/[token]">) {
  return (
    <LibraryBackdrop overlay="login" priority position="50% 14%" className="min-h-svh">
      <div className="mx-auto flex min-h-svh max-w-6xl flex-col items-center justify-center gap-6 px-4 py-10 sm:px-6">
        <div className="w-full max-w-[440px] animate-rise rounded-2xl border border-white/40 bg-white/95 p-7 shadow-lift backdrop-blur-xl sm:p-9">
          <SchoolLogo size={60} className="mb-6" priority />
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-wood">Lista d&apos;attesa</p>
          <Suspense fallback={<AreaLoading />}>
            <OfferContent params={params} />
          </Suspense>
        </div>
        <AppCredit tone="light" />
      </div>
    </LibraryBackdrop>
  );
}

/** Confronto con l'ora attuale del server (valutato alla richiesta, dopo connection()). */
function isPast(iso: string): boolean {
  return new Date(iso).getTime() <= new Date().getTime();
}

const expiresFmt = (iso: string) =>
  new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }).format(new Date(iso));

async function OfferContent({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const valid = /^[0-9a-f]{64}$/.test(token);
  const { data } = valid && isSupabaseConfigured() ? await createSupabaseAdminClient().rpc("get_offer_by_token", { p_token: token }) : { data: null };
  const offer = data?.[0];

  if (!offer) {
    return <State icon={<CircleX />} title="Link non valido">Il link non esiste o è stato copiato in modo incompleto. Controlla l&apos;email ricevuta.</State>;
  }
  const day = formatDayMedium(offer.day);
  const hours = `${formatTime(offer.opens_at)}–${formatTime(offer.closes_at)}`;
  const expired = offer.status === "expired" || (offer.status === "pending" && isPast(offer.expires_at));

  if (offer.status === "accepted") {
    return <State icon={<CircleCheck />} title="Posto già confermato" day={day} hours={hours}>Questo link è già stato usato: la prenotazione è nell&apos;area personale.</State>;
  }
  if (expired) {
    return <State icon={<Hourglass />} title="Proposta scaduta" day={day} hours={hours}>Il tempo per confermare è terminato e il posto è passato allo studente successivo.</State>;
  }
  if (offer.status === "declined") {
    return <State icon={<CircleX />} title="Hai rinunciato" day={day} hours={hours}>Il posto è stato proposto allo studente successivo.</State>;
  }
  if (offer.status === "revoked" || !offer.day_is_open) {
    return <State icon={<CircleX />} title="Proposta annullata" day={day} hours={hours}>La giornata è stata chiusa o la proposta è stata annullata dai docenti.</State>;
  }

  return (
    <>
      <h1 className="font-display text-[1.75rem] font-semibold leading-tight text-ink text-balance">
        {offer.first_name ? `${offer.first_name}, si` : "Si"} è liberato un posto per te
      </h1>
      <div className="mt-5 rounded-xl border border-line bg-paper p-4">
        <p className="font-display text-lg font-semibold text-ink first-letter:uppercase">{day}</p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted"><Clock3 className="size-4" /> {hours} · biblioteca storica</p>
      </div>
      <OfferResponse token={token} expiresLabel={expiresFmt(offer.expires_at)} />
    </>
  );
}

function State({ icon, title, children, day, hours }: { icon: ReactNode; title: string; children: ReactNode; day?: string; hours?: string }) {
  return (
    <>
      <h1 className="flex items-center gap-2 font-display text-[1.6rem] font-semibold text-ink [&_svg]:size-6 [&_svg]:text-wood">
        {icon} {title}
      </h1>
      {day && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-muted first-letter:uppercase">
          <CalendarClock className="size-4" /> {day}, {hours}
        </p>
      )}
      <p className="mt-3 text-sm text-muted">{children}</p>
      <ButtonLink href={ROUTES.student} variant="secondary" className="mt-6 w-full">Vai all&apos;area personale</ButtonLink>
    </>
  );
}
