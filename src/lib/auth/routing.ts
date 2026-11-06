import { ROUTES } from "@/lib/config";

export type SessionInfo =
  | { kind: "anonymous" }
  | { kind: "student"; registered: boolean }
  | { kind: "teacher"; mustChangePassword: boolean }
  | { kind: "invalid" }; // sessione valida ma senza profilo autorizzato o con metodo di accesso errato

const under = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

/**
 * Dove deve andare una richiesta verso un'area riservata.
 * Restituisce null se può proseguire, altrimenti il percorso di redirect.
 * Usata dal proxy, così il controllo del ruolo avviene prima di qualsiasi
 * rendering (redirect HTTP 307, nessuna pagina parziale inviata).
 */
export function protectedRedirect(path: string, session: SessionInfo): string | null {
  const teacherArea = under(path, ROUTES.teacher);
  const studentArea = under(path, ROUTES.student) || under(path, ROUTES.registration);
  if (!teacherArea && !studentArea) return null;

  if (session.kind === "anonymous" || session.kind === "invalid") return teacherArea ? ROUTES.teacherLogin : ROUTES.login;

  if (session.kind === "student") {
    if (teacherArea) return ROUTES.student;
    if (!session.registered && !under(path, ROUTES.registration)) return ROUTES.registration;
    if (session.registered && under(path, ROUTES.registration)) return ROUTES.student;
    return null;
  }

  // docente
  if (studentArea) return ROUTES.teacher;
  if (session.mustChangePassword && !under(path, ROUTES.teacherPassword)) return ROUTES.teacherPassword;
  return null;
}
