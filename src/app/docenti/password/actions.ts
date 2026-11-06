"use server";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { passwordProblems } from "@/lib/auth/password-policy";
import { clientIp } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { lockoutMessage, lockoutSeconds, recordAttempt } from "@/lib/auth/throttle";
import { publicEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PasswordChangeState = { error?: string; fieldErrors?: Record<string, string>; done?: boolean };

const schema = z.object({
  current: z.string().min(1, "Inserisci la password attuale").max(200),
  next: z.string().max(200),
  confirm: z.string().max(200),
});

/**
 * Cambio password del docente collegato.
 *  1. solo un docente con sessione email+password valida;
 *  2. la password attuale viene verificata di nuovo (con blocco dei tentativi);
 *  3. la nuova password rispetta le regole ed è diversa da quella iniziale;
 *  4. Supabase Auth aggiorna la password; poi il server (service role)
 *     toglie l'obbligo di cambio: il docente non può farlo da solo.
 */
export async function changeTeacherPassword(_prev: PasswordChangeState, formData: FormData): Promise<PasswordChangeState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "teacher") return { error: "Sessione non valida. Accedi di nuovo." };

  const parsed = schema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { fieldErrors: { current: "Inserisci la password attuale" } };
  const { current, next, confirm } = parsed.data;

  const fieldErrors: Record<string, string> = {};
  const problems = passwordProblems(next, { email: user.email, initialPassword: process.env.TEACHER_INITIAL_PASSWORD });
  if (problems.length) fieldErrors.next = `La nuova password deve avere: ${problems.join(", ")}.`;
  else if (next === current) fieldErrors.next = "La nuova password deve essere diversa da quella attuale.";
  if (next !== confirm) fieldErrors.confirm = "Le due password non coincidono.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const ip = await clientIp();
  const locked = await lockoutSeconds(user.email, ip);
  if (locked === null) return { error: "Impossibile verificare la richiesta in questo momento. Riprova più tardi." };
  if (locked > 0) return { error: lockoutMessage(locked) };

  // verifica della password attuale con un client separato, senza toccare i cookie
  const verifier = createClient(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error: verifyError } = await verifier.auth.signInWithPassword({ email: user.email, password: current });
  if (verifyError) {
    await recordAttempt("password_change", user.email, ip, false);
    return { fieldErrors: { current: "La password attuale non è corretta." } };
  }
  await verifier.auth.signOut({ scope: "local" });
  await recordAttempt("password_change", user.email, ip, true);

  const supabase = await createSupabaseServerClient();
  const { error: updateError } = await supabase.auth.updateUser({ password: next });
  if (updateError) {
    if (updateError.code === "weak_password") return { fieldErrors: { next: "Password troppo debole per le regole di sicurezza del sistema." } };
    if (updateError.code === "same_password") return { fieldErrors: { next: "La nuova password deve essere diversa da quella attuale." } };
    return { error: "Non è stato possibile aggiornare la password. Riprova." };
  }

  const admin = createSupabaseAdminClient();
  const { error: markError } = await admin.rpc("mark_teacher_password_changed", { p_teacher_id: user.id });
  if (markError) return { error: "Password aggiornata, ma non è stato possibile registrare la modifica. Contatta l'amministratore." };

  return { done: true };
}
