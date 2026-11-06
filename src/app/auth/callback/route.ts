import { NextResponse, type NextRequest } from "next/server";
import { isAllowedStudentEmail } from "@/lib/auth/domain";
import { ROUTES } from "@/lib/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Ritorno dal login Google (flusso OAuth PKCE di Supabase).
 *
 * Controlli lato server, sull'identità effettivamente autenticata:
 *  1. se il database ha rifiutato la creazione dell'account (dominio,
 *     provider o email non verificata) Supabase torna qui con un errore;
 *  2. lo scambio del codice avviene tra server e Supabase Auth, che
 *     restituisce l'utente autenticato: si controllano dominio, verifica
 *     dell'email e identità Google;
 *  3. il ruolo è letto dal database: un docente non può entrare con Google.
 * Ogni sessione che non supera i controlli viene chiusa subito.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const fail = (code: string) => NextResponse.redirect(`${origin}${ROUTES.login}?errore=${code}`);

  const providerError = searchParams.get("error");
  if (providerError) {
    const description = (searchParams.get("error_description") ?? "").toLowerCase();
    // il trigger del database che rifiuta l'account produce "Database error saving new user"
    if (description.includes("database error") || providerError === "access_denied") {
      return fail(providerError === "access_denied" ? "accesso_annullato" : "account_non_autorizzato");
    }
    return fail("accesso_non_riuscito");
  }

  const code = searchParams.get("code");
  if (!code) return fail("codice_mancante");

  const supabase = await createSupabaseServerClient();
  const { data: exchanged, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !exchanged.user) return fail("accesso_non_riuscito");

  // utente restituito da Supabase Auth nello scambio server-server del codice
  const user = exchanged.user;
  const googleIdentity = user?.identities?.find((i) => i.provider === "google");
  const emailVerified =
    googleIdentity?.identity_data?.email_verified === true || user?.user_metadata?.email_verified === true;

  // ruolo letto dal database con il client di servizio (solo lato server)
  const admin = createSupabaseAdminClient();
  const [{ data: teacherRow }, { data: studentRow }] = await Promise.all([
    admin.from("teachers").select("id").eq("id", user.id).eq("is_active", true).maybeSingle(),
    admin.from("students").select("id, registered_at").eq("id", user.id).eq("is_active", true).maybeSingle(),
  ]);
  const role = teacherRow ? "teacher" : studentRow ? "student" : null;

  if (role === "teacher") {
    await supabase.auth.signOut({ scope: "local" });
    return fail("docente_usa_password");
  }
  if (role !== "student" || !googleIdentity || !emailVerified || !isAllowedStudentEmail(user.email)) {
    // motivo nel log del server (senza dati personali), utile per la diagnosi
    console.warn("[auth/callback] accesso rifiutato", {
      role, google: Boolean(googleIdentity), verified: emailVerified, domain: isAllowedStudentEmail(user?.email),
    });
    await supabase.auth.signOut({ scope: "local" });
    return fail("account_non_autorizzato");
  }

  const destination = studentRow?.registered_at ? ROUTES.student : ROUTES.registration;
  return NextResponse.redirect(`${origin}${destination}`);
}
