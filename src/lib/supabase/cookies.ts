import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Cookie di sessione Supabase: httpOnly (non leggibili da JavaScript,
 * quindi non sottraibili con un attacco XSS), Secure in produzione,
 * SameSite=Lax. Tutte le operazioni di autenticazione avvengono sul
 * server: il browser non ha bisogno di leggere la sessione.
 */
export const SESSION_COOKIE_OPTIONS: CookieOptionsWithName = {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
};
