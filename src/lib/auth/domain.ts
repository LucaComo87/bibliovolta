import { AUTH } from "@/lib/config";

/**
 * true solo per indirizzi del tipo nome@stud.liceovoltacomo.edu.it:
 * una sola @, parte locale non vuota, dominio esattamente uguale
 * (niente sottodomini come x@evil.stud… né suffissi come …edu.it.evil.com).
 * Lo stesso controllo è applicato nel database (is_allowed_student_email).
 */
export function isAllowedStudentEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const value = email.trim().toLowerCase();
  const parts = value.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  return local.length > 0 && !/\s/.test(local) && domain === AUTH.studentEmailDomain;
}
