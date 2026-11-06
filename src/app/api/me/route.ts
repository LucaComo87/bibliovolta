import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Profilo dell'utente collegato. Esempio di API protetta:
 * 401 senza sessione valida; restituisce SOLO i dati di chi chiama.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const body =
    user.role === "student"
      ? {
          role: user.role,
          email: user.email,
          firstName: user.profile.first_name,
          lastName: user.profile.last_name,
          className: user.profile.class_name,
          registered: !user.needsRegistration,
        }
      : { role: user.role, email: user.email, fullName: user.profile.full_name, mustChangePassword: user.mustChangePassword };
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
