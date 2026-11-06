/**
 * BIBLIOVOLTA · Reimpostazione della password di un docente
 *
 * Riporta la password del docente a TEACHER_INITIAL_PASSWORD e lo obbliga
 * a sceglierne una nuova al prossimo accesso. Chiude le sessioni aperte.
 *
 *   npm run teacher:reset-password -- --email nome.cognome@liceovoltacomo.edu.it
 */
import { createClient } from "@supabase/supabase-js";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { email: { type: "string" } } });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const initial = process.env.TEACHER_INITIAL_PASSWORD;
  if (!url || !serviceKey || !initial) throw new Error("Servono NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e TEACHER_INITIAL_PASSWORD");
  const email = values.email?.trim().toLowerCase();
  if (!email) throw new Error("Specifica --email");

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: teacher, error: findError } = await supabase.from("teachers").select("id").eq("email", email).maybeSingle();
  if (findError) throw new Error(findError.message);
  if (!teacher) throw new Error(`Nessun docente con email ${email}`);

  const { error } = await supabase.auth.admin.updateUserById(teacher.id, { password: initial });
  if (error) throw new Error(error.message);
  const { error: flagError } = await supabase.rpc("require_teacher_password_change", { p_teacher_id: teacher.id });
  if (flagError) throw new Error(flagError.message);
  await supabase.auth.admin.signOut(teacher.id, "global").catch(() => undefined);

  console.log(`Password di ${email} reimpostata. Al prossimo accesso dovrà sceglierne una nuova.`);
}

main().catch((e) => {
  console.error(`Errore: ${(e as Error).message}`);
  process.exit(1);
});
