import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isAllowedStudentEmail } from "@/lib/auth/domain";
import { ROUTES } from "@/lib/config";
import type { Student, Teacher, UserRole } from "@/lib/database.types";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthMethod = "oauth" | "password" | "other";

export type CurrentUser =
  | { id: string; email: string; role: "student"; method: AuthMethod; profile: Student; needsRegistration: boolean }
  | { id: string; email: string; role: "teacher"; method: AuthMethod; profile: Teacher; mustChangePassword: boolean };

/** Metodo con cui è stata creata la sessione, dal claim "amr" del JWT firmato. */
function authMethodOf(claims: Record<string, unknown>): AuthMethod {
  const amr = Array.isArray(claims.amr) ? (claims.amr as { method?: string }[]) : [];
  const last = amr[amr.length - 1]?.method ?? amr[0]?.method;
  if (last === "oauth") return "oauth";
  if (last === "password") return "password";
  return "other";
}

/**
 * Data Access Layer: unico punto in cui si legge l'utente collegato.
 *  - identità verificata con getClaims() (firma del JWT);
 *  - ruolo e profilo letti dal database (soggetti alla RLS);
 *  - coerenza del metodo di accesso: gli studenti SOLO con Google
 *    (oauth) e un'email del dominio scolastico, i docenti SOLO con
 *    email e password. Una sessione incoerente viene ignorata.
 * Restituisce null se l'utente non è collegato o non è autorizzato.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  await connection(); // sempre valutato alla richiesta, mai prerenderizzato
  if (!isSupabaseConfigured()) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims as Record<string, unknown> | undefined;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;
  if (error || !claims || !userId) return null;
  const method = authMethodOf(claims);

  const { data: teacher } = await supabase
    .from("teachers")
    .select("*")
    .eq("id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (teacher) {
    if (method !== "password") return null; // i docenti non usano Google
    return { id: userId, email: teacher.email, role: "teacher", method, profile: teacher, mustChangePassword: teacher.must_change_password };
  }

  const { data: student } = await supabase
    .from("students")
    .select("*")
    .eq("id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (student) {
    if (method !== "oauth" || !isAllowedStudentEmail(student.email)) return null;
    return { id: userId, email: student.email, role: "student", method, profile: student, needsRegistration: !student.registered_at };
  }

  return null;
}

/** Pagina iniziale dell'area corrispondente al ruolo. */
export function homeForRole(role: UserRole): string {
  return role === "teacher" ? ROUTES.teacher : ROUTES.student;
}

/** Dove mandare un utente appena autenticato. */
export function landingFor(user: CurrentUser): string {
  if (user.role === "student") return user.needsRegistration ? ROUTES.registration : ROUTES.student;
  return user.mustChangePassword ? ROUTES.teacherPassword : ROUTES.teacher;
}

type RequireOptions = {
  /** consente l'accesso allo studente che non ha ancora completato la registrazione */
  allowUnregistered?: boolean;
  /** consente l'accesso al docente che deve ancora cambiare la password iniziale */
  allowPasswordChange?: boolean;
};

/**
 * Protezione lato server delle aree riservate:
 *  - non collegato → schermata di accesso del ruolo richiesto;
 *  - ruolo diverso → la propria area (uno studente non entra in /docenti);
 *  - registrazione o cambio password in sospeso → la pagina dedicata.
 */
export async function requireRole<R extends UserRole>(
  role: R,
  options: RequireOptions = {},
): Promise<Extract<CurrentUser, { role: R }>> {
  const user = await getCurrentUser();
  if (!user) redirect(role === "teacher" ? ROUTES.teacherLogin : ROUTES.login);
  if (user.role !== role) redirect(homeForRole(user.role));
  if (user.role === "student" && user.needsRegistration && !options.allowUnregistered) redirect(ROUTES.registration);
  if (user.role === "teacher" && user.mustChangePassword && !options.allowPasswordChange) redirect(ROUTES.teacherPassword);
  return user as Extract<CurrentUser, { role: R }>;
}
