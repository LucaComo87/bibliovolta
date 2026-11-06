import { timingSafeEqual } from "node:crypto";
import { NextResponse, connection, type NextRequest } from "next/server";
import { dispatchNotifications } from "@/lib/email/outbox";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Manutenzione automatica della lista d'attesa + invio delle email.
 * Chiamato ogni minuto da Supabase Cron (pg_net) o da Vercel Cron,
 * con l'intestazione Authorization: Bearer <CRON_SECRET>.
 * Funziona anche quando nessuno è collegato al sito.
 */
function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(request: NextRequest) {
  await connection();
  if (!authorized(request)) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const admin = createSupabaseAdminClient();
  const { data: maintenance, error } = await admin.rpc("run_waitlist_maintenance");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const email = await dispatchNotifications(100);
  return NextResponse.json({ maintenance, email }, { headers: { "Cache-Control": "no-store" } });
}

export const GET = handle;
export const POST = handle;
