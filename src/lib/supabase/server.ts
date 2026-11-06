import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { publicEnv } from "@/lib/env";
import { SESSION_COOKIE_OPTIONS } from "./cookies";

/**
 * Client Supabase per Server Components, Server Actions e Route Handlers.
 * Agisce con l'identità dell'utente collegato (cookie di sessione),
 * quindi è soggetto alla Row Level Security.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chiamato da un Server Component: i cookie si aggiornano nel proxy.
        }
      },
    },
  });
}
