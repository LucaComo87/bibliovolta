"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { ROUTES } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type RegistrationState = {
  error?: string;
  fieldErrors?: Partial<Record<"firstName" | "lastName" | "classYear" | "classSection", string>>;
  values?: { firstName: string; lastName: string; classYear: string; classSection: string };
};

const NAME = /^[A-Za-zÀ-ÖØ-öø-ÿĀ-ž]+([ '’.-][A-Za-zÀ-ÖØ-öø-ÿĀ-ž]+)*\.?$/;

const schema = z.object({
  firstName: z.string().trim().min(1, "Inserisci il nome").max(60, "Massimo 60 caratteri").regex(NAME, "Usa solo lettere, spazi, apostrofi o trattini"),
  lastName: z.string().trim().min(1, "Inserisci il cognome").max(60, "Massimo 60 caratteri").regex(NAME, "Usa solo lettere, spazi, apostrofi o trattini"),
  classYear: z.enum(["1", "2", "3", "4", "5"], { message: "Scegli l'anno" }),
  classSection: z.string().trim().toUpperCase().regex(/^[A-Z]{1,3}$/, "Indica la sezione, es. B"),
});

/**
 * Registrazione iniziale dello studente.
 * L'email NON arriva dal modulo: è quella dell'account Google autenticato.
 * Il salvataggio passa dalla funzione del database complete_student_registration,
 * che modifica solo la riga dell'utente collegato e solo una volta.
 */
export async function completeRegistration(_prev: RegistrationState, formData: FormData): Promise<RegistrationState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") return { error: "Sessione non valida. Accedi di nuovo con Google." };
  if (!user.needsRegistration) redirect(ROUTES.student);

  const values = {
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    classYear: String(formData.get("classYear") ?? ""),
    classSection: String(formData.get("classSection") ?? ""),
  };
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: RegistrationState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof NonNullable<RegistrationState["fieldErrors"]>;
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors, values };
  }

  const { firstName, lastName, classYear, classSection } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("complete_student_registration", {
    p_first_name: firstName,
    p_last_name: lastName,
    p_class_name: `${classYear}${classSection}`,
  });
  if (error) {
    if (error.hint === "already_registered") redirect(ROUTES.student);
    return { error: "Non è stato possibile salvare la registrazione. Controlla i dati e riprova.", values };
  }
  redirect(ROUTES.student);
}
