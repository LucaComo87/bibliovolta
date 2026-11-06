import "server-only";

import { CALENDAR } from "@/lib/config";
import { configurationReport, isSupabaseConfigured } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SystemHealth = {
  ok: boolean;
  config: ReturnType<typeof configurationReport>;
  database: {
    reachable: boolean;
    schoolDays?: number;
    openDays?: number;
    seasonStart?: string;
    seasonEnd?: string;
    error?: string;
  };
  checkedAt: string;
};

/**
 * Controlla configurazione e raggiungibilità del database.
 * Non espone mai valori delle chiavi né dati personali.
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  const config = configurationReport();
  const database: SystemHealth["database"] = { reachable: false };

  if (!isSupabaseConfigured()) {
    database.error = "Supabase non configurato (vedi .env.example).";
  } else if (!config.supabaseServiceRole) {
    database.error = "SUPABASE_SERVICE_ROLE_KEY mancante: impossibile verificare il database dal server.";
  } else {
    try {
      const admin = createSupabaseAdminClient();
      const [all, open, settings] = await Promise.all([
        admin.from("school_days").select("id", { count: "exact", head: true })
          .gte("day", CALENDAR.seasonStart).lte("day", CALENDAR.seasonEnd),
        admin.from("school_days").select("id", { count: "exact", head: true })
          .gte("day", CALENDAR.seasonStart).lte("day", CALENDAR.seasonEnd).eq("is_open", true),
        admin.from("app_settings").select("season_start, season_end").eq("id", 1).single(),
      ]);
      const failure = all.error ?? open.error ?? settings.error;
      if (failure) throw new Error(failure.message);
      database.reachable = true;
      database.schoolDays = all.count ?? 0;
      database.openDays = open.count ?? 0;
      database.seasonStart = settings.data?.season_start;
      database.seasonEnd = settings.data?.season_end;
    } catch (e) {
      database.error = e instanceof Error ? e.message : "errore sconosciuto";
    }
  }

  return { ok: database.reachable, config, database, checkedAt: new Date().toISOString() };
}
