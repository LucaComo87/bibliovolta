"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { clientIp } from "@/lib/auth/request";
import { lockoutMessage, lockoutSeconds, recordAttempt } from "@/lib/auth/throttle";
import { ROUTES } from "@/lib/config";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TeacherLoginState = { error?: string; email?: string };

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

const GENERIC_ERROR = "Email o password non corretti.";

/**
 * Accesso docenti (solo email e password, mai Google).
 * Tutto avviene sul server: verifica del blocco per tentativi ripetuti,
 * accesso con Supabase Auth, controllo che l'account sia davvero un docente.
 * Il messaggio d'errore è sempre lo stesso, per non rivelare quali email esistono.
 */
export async function teacherSignIn(_prev: TeacherLoginState, formData: FormData): Promise<TeacherLoginState> {
  if (!isSupabaseConfigured()) return { error: "Il servizio di accesso non è ancora configurato." };

  const parsed = schema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: GENERIC_ERROR, email: String(formData.get("email") ?? "") };
  const { email, password } = parsed.data;
  const ip = await clientIp();

  const locked = await lockoutSeconds(email, ip);
  if (locked === null) return { error: "Impossibile verificare l'accesso in questo momento. Riprova più tardi.", email };
  if (locked > 0) return { error: lockoutMessage(locked), email };

  const supabase = await createSupabaseServerClient();
  const { data: signIn, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    await recordAttempt("teacher_login", email, ip, false);
    if (error.status === 429) return { error: "Troppe richieste. Attendi qualche minuto e riprova.", email };
    return { error: GENERIC_ERROR, email };
  }

  // ruolo letto dal database con il client di servizio (solo lato server)
  const { data: teacher } = await createSupabaseAdminClient()
    .from("teachers")
    .select("must_change_password")
    .eq("id", signIn.user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!teacher) {
    await supabase.auth.signOut({ scope: "local" });
    await recordAttempt("teacher_login", email, ip, false);
    return { error: GENERIC_ERROR, email };
  }

  await recordAttempt("teacher_login", email, ip, true);
  redirect(teacher.must_change_password ? ROUTES.teacherPassword : ROUTES.teacher);
}
