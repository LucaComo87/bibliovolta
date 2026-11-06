import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { publicEnv } from "@/lib/env";

/**
 * Client con SERVICE ROLE: ignora la RLS.
 * Da usare SOLO lato server per operazioni di sistema (es. invio email,
 * job pianificati). Non va mai importato in un Client Component:
 * "server-only" fa fallire la build se succede.
 */
export function createSupabaseAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!publicEnv.supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_URL non configurate.");
  }
  return createClient<Database>(publicEnv.supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
