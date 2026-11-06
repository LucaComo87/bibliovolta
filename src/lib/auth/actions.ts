"use server";

import { redirect } from "next/navigation";
import { AUTH, ROUTES } from "@/lib/config";
import { isSupabaseConfigured } from "@/lib/env";
import { requestOrigin } from "@/lib/auth/request";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Avvia l'accesso studenti con Google (flusso OAuth PKCE di Supabase).
 * Viene eseguito sul server: il codice di verifica PKCE finisce in un
 * cookie httpOnly e il browser viene mandato alla pagina di Google.
 * "hd" chiede a Google di proporre solo account del dominio scolastico:
 * è solo un suggerimento, il controllo vero avviene nel database e
 * nel ritorno /auth/callback.
 */
export async function startGoogleSignIn(): Promise<void> {
  if (!isSupabaseConfigured()) redirect(`${ROUTES.login}?errore=non_configurato`);

  const supabase = await createSupabaseServerClient();
  const origin = await requestOrigin();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}${ROUTES.authCallback}`,
      skipBrowserRedirect: true,
      queryParams: { hd: AUTH.studentEmailDomain, prompt: "select_account" },
    },
  });
  if (error || !data?.url) redirect(`${ROUTES.login}?errore=accesso_non_riuscito`);
  redirect(data.url);
}

/** Esce dalla sessione corrente (studenti e docenti). */
export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut({ scope: "local" });
  }
  redirect(ROUTES.home);
}
