"use server";

import { after } from "next/server";
import { z } from "zod";
import { toBookingError } from "@/lib/bookings/server";
import { dispatchSoon } from "@/lib/email/outbox";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type OfferResponseState = { done?: "accepted" | "declined"; error?: string };

const schema = z.object({
  token: z.string().regex(/^[0-9a-f]{64}$/),
  decision: z.enum(["accept", "decline"]),
});

/**
 * Risposta alla proposta ricevuta via email. Il token è verificato nel
 * database (hash SHA-256, stato "in attesa", scadenza, uso singolo);
 * la conferma è atomica e rispetta il limite di 50 posti.
 * Solo POST: aprire il link non conferma nulla (i filtri antispam che
 * "visitano" i link non possono accettare al posto dello studente).
 */
export async function respondToOffer(_prev: OfferResponseState, formData: FormData): Promise<OfferResponseState> {
  const parsed = schema.safeParse({ token: formData.get("token"), decision: formData.get("decision") });
  if (!parsed.success) return { error: "Link non valido." };
  const admin = createSupabaseAdminClient();
  const { token, decision } = parsed.data;
  const { error } =
    decision === "accept"
      ? await admin.rpc("accept_offer_by_token", { p_token: token })
      : await admin.rpc("decline_offer_by_token", { p_token: token });
  after(dispatchSoon);
  if (error) {
    const r = toBookingError(error);
    return { error: r.ok ? undefined : r.message };
  }
  return { done: decision === "accept" ? "accepted" : "declined" };
}
