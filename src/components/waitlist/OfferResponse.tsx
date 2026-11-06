"use client";

import { CalendarCheck2, CircleCheck, LoaderCircle, X } from "lucide-react";
import { useActionState } from "react";
import { respondToOffer, type OfferResponseState } from "@/app/proposta/actions";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { ROUTES } from "@/lib/config";

export function OfferResponse({ token, expiresLabel }: { token: string; expiresLabel: string }) {
  const [state, action, pending] = useActionState<OfferResponseState, FormData>(respondToOffer, {});

  if (state.done === "accepted") {
    return (
      <div className="mt-6 space-y-4">
        <Notice title="Posto confermato">Il posto è tuo. Ti abbiamo inviato un&apos;email di conferma.</Notice>
        <ButtonLink href={`${ROUTES.student}/prenotazioni`} size="lg" className="w-full">
          <CircleCheck /> Le mie prenotazioni
        </ButtonLink>
      </div>
    );
  }
  if (state.done === "declined") {
    return (
      <div className="mt-6">
        <Notice title="Hai rinunciato al posto">Il posto è stato proposto allo studente successivo. Grazie!</Notice>
      </div>
    );
  }

  return (
    <form action={action} className="mt-6 space-y-3">
      <input type="hidden" name="token" value={token} />
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <p className="text-sm text-muted">Conferma entro <strong className="text-ink">{expiresLabel}</strong>.</p>
      <Button type="submit" name="decision" value="accept" size="lg" className="w-full" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" /> : <CalendarCheck2 />} Conferma il posto
      </Button>
      <Button type="submit" name="decision" value="decline" variant="secondary" className="w-full" disabled={pending}>
        <X /> Non mi serve più, rinuncio
      </Button>
    </form>
  );
}
