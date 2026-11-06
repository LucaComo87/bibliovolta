/**
 * Lettura centralizzata delle variabili d'ambiente.
 * Le chiavi NON sono mai scritte nel codice: arrivano da .env.local
 * (sviluppo) o dalle Environment Variables di Vercel (produzione).
 *
 * Le variabili NEXT_PUBLIC_* sono pubbliche per definizione (finiscono nel
 * browser) e vanno lette con accesso statico, altrimenti Next.js non le
 * incorpora nel bundle client.
 */

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  // Supabase ha rinominato la "anon key" in "publishable key": accettiamo entrambe.
  supabaseKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};

export function isSupabaseConfigured(): boolean {
  return /^https?:\/\//.test(publicEnv.supabaseUrl) && publicEnv.supabaseKey.length > 0;
}

/** Stato della configurazione, senza mai rivelare i valori delle chiavi. */
export function configurationReport() {
  return {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabasePublicKey: publicEnv.supabaseKey.length > 0,
    supabaseServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    resendApiKey: Boolean(process.env.RESEND_API_KEY),
    emailFrom: Boolean(process.env.EMAIL_FROM),
    siteUrl: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
  };
}
