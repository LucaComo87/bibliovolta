import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AttemptKind = "teacher_login" | "password_change";

/**
 * Protezione dagli accessi ripetuti, memorizzata nel database (funziona
 * anche con più istanze serverless). Se il controllo non è possibile
 * (configurazione mancante o errore) l'accesso viene NEGATO.
 */
export async function lockoutSeconds(email: string, ip: string): Promise<number | null> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("auth_lockout_seconds", { p_email: email, p_ip: ip });
    if (error) return null;
    return data ?? 0;
  } catch {
    return null;
  }
}

export async function recordAttempt(kind: AttemptKind, email: string, ip: string, succeeded: boolean): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    await admin.rpc("record_auth_attempt", { p_kind: kind, p_email: email, p_ip: ip, p_succeeded: succeeded });
  } catch {
    // il registro dei tentativi non deve mai bloccare un accesso valido già verificato
  }
}

export function lockoutMessage(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Troppi tentativi non riusciti. Per sicurezza l'accesso è bloccato: riprova tra ${minutes} ${minutes === 1 ? "minuto" : "minuti"}.`;
}
