import "server-only";

import { Resend } from "resend";

export type OutgoingEmail = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
};

let client: Resend | null = null;

function getClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY non configurata.");
  client ??= new Resend(apiKey);
  return client;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/**
 * Invio di un'email tramite Resend (solo lato server).
 * Restituisce l'id del messaggio, da salvare in announcement_deliveries.
 * Utilizzato dalle comunicazioni e dalle notifiche (Fase 6).
 */
export async function sendEmail(message: OutgoingEmail): Promise<string> {
  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM non configurata.");

  const { data, error } = await getClient().emails.send({ from, ...message });
  if (error || !data) {
    const permanent = Boolean(error && PERMANENT.has(error.name));
    throw new EmailError(`Invio email non riuscito: ${error?.message ?? "risposta vuota"}`, permanent);
  }
  return data.id;
}

/** Errori di Resend che non si risolvono riprovando (indirizzo o messaggio rifiutati). */
const PERMANENT = new Set(["validation_error", "invalid_parameter", "invalid_from_address", "missing_required_field"]);

export class EmailError extends Error {
  constructor(message: string, readonly permanent: boolean) {
    super(message);
    this.name = "EmailError";
  }
}
