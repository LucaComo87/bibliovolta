/**
 * BIBLIOVOLTA · Creazione di un account docente
 *
 * Gli account docente NON si registrano dal sito: li crea l'amministratore
 * con questo script, che usa la service role key (mai esposta al browser).
 * La password iniziale è quella della variabile TEACHER_INITIAL_PASSWORD
 * (in .env.local, mai nel codice). Al primo accesso il docente è obbligato
 * a sceglierne una personale.
 *
 *   npm run teacher:create -- --email nome.cognome@liceovoltacomo.edu.it --name "Nome Cognome" [--admin]
 */
import { createClient } from "@supabase/supabase-js";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string", default: "" },
    admin: { type: "boolean", default: false },
  },
});

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const initial = process.env.TEACHER_INITIAL_PASSWORD;
  if (!url || !serviceKey) throw new Error("Imposta NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY in .env.local");
  if (!initial) throw new Error("Imposta TEACHER_INITIAL_PASSWORD in .env.local");
  const email = values.email?.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+$/.test(email)) throw new Error("Specifica --email");
  if (email.endsWith("@stud.liceovoltacomo.edu.it")) throw new Error("Un indirizzo studenti non può essere un account docente");

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  // 1. pre-autorizzazione: solo le email invitate possono diventare docenti
  const { error: inviteError } = await supabase
    .from("teacher_invitations")
    .upsert({ email, full_name: values.name, is_admin: values.admin });
  if (inviteError) throw new Error(inviteError.message);
  // 2. creazione dell'account in Supabase Auth (il trigger crea il profilo docente)
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: initial,
    email_confirm: true,
    user_metadata: { full_name: values.name },
  });
  if (error) throw new Error(error.message);

  console.log(`Docente creato: ${data.user.email} (${values.admin ? "amministratore" : "docente"})`);
  console.log("Password iniziale: quella di TEACHER_INITIAL_PASSWORD. Al primo accesso verrà chiesto di cambiarla.");
}

main().catch((e) => {
  console.error(`Errore: ${(e as Error).message}`);
  process.exit(1);
});
