import "server-only";

import type { NotificationRow } from "@/lib/database.types";
import { EmailError, isEmailConfigured, sendEmail } from "@/lib/email/resend";
import { renderNotification } from "@/lib/email/templates";
import { publicEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type DispatchReport = { configured: boolean; claimed: number; sent: number; failed: number };

/**
 * Invia le email in coda (notification_outbox).
 * La presa in carico è atomica nel database (FOR UPDATE SKIP LOCKED):
 * più istanze del server possono lavorare insieme senza doppi invii.
 * Dopo l'invio il token in chiaro viene cancellato dalla coda.
 */
export async function dispatchNotifications(limit = 50): Promise<DispatchReport> {
  if (!isEmailConfigured()) return { configured: false, claimed: 0, sent: 0, failed: 0 };
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("claim_notifications", { p_limit: limit });
  if (error) throw new Error(`Coda email non disponibile: ${error.message}`);
  const rows = (data ?? []) as NotificationRow[];
  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const email = renderNotification(row.kind, row.payload, publicEnv.siteUrl);
      const id = await sendEmail({ to: row.to_email, ...email });
      await admin.rpc("complete_notification", { p_id: row.id, p_ok: true, p_provider_id: id, p_error: null });
      sent++;
    } catch (e) {
      await admin.rpc("complete_notification", {
        p_id: row.id,
        p_ok: false,
        p_provider_id: null,
        p_error: e instanceof Error ? e.message : String(e),
        p_permanent: e instanceof EmailError && e.permanent,
      });
      failed++;
    }
  }
  return { configured: true, claimed: rows.length, sent, failed };
}

/** Da usare con after(): invio subito dopo la risposta, senza bloccare l'utente. */
export async function dispatchSoon(): Promise<void> {
  try {
    await dispatchNotifications(25);
  } catch (e) {
    console.error("[email] invio non riuscito, verrà ritentato dal cron:", e instanceof Error ? e.message : e);
  }
}
