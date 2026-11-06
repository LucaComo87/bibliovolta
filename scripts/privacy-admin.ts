/**
 * BIBLIOVOLTA · Strumenti privacy per l'amministratore (solo service role)
 *
 *   npm run privacy:export -- --email nome.cognome@stud.liceovoltacomo.edu.it
 *       copia dei dati di uno studente (richiesta di accesso ricevuta dalla scuola)
 *   npm run privacy:erase  -- --email nome.cognome@stud.liceovoltacomo.edu.it --conferma
 *       cancellazione definitiva su richiesta (profilo, prenotazioni, liste,
 *       comunicazioni ricevute; registro anonimizzato)
 *   npm run privacy:purge
 *       applica subito i tempi di conservazione (lo fa già Supabase Cron ogni notte)
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { email: { type: "string" }, conferma: { type: "boolean", default: false } },
});

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Imposta NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY in .env.local");
  const db = createClient(url, key, { auth: { persistSession: false } });
  const command = positionals[0];

  if (command === "purge") {
    const { data, error } = await db.rpc("purge_expired_data");
    if (error) throw new Error(error.message);
    console.log("Conservazione applicata:", data);
    return;
  }

  const email = values.email?.trim().toLowerCase();
  if (!email) throw new Error("Specifica --email");
  const { data: student, error: findError } = await db.from("students").select("id, email, first_name, last_name, class_name").eq("email", email).maybeSingle();
  if (findError) throw new Error(findError.message);
  if (!student) throw new Error(`Nessuno studente con email ${email}`);

  if (command === "export") {
    const [bookings, waits, deliveries] = await Promise.all([
      db.from("bookings").select("status, source, created_at, cancelled_at, cancel_reason, school_days(day)").eq("student_id", student.id),
      db.from("waitlist_entries").select("status, joined_at, school_days(day)").eq("student_id", student.id),
      db.from("announcement_deliveries").select("email_status, sent_at, announcements(title, body, published_at)").eq("student_id", student.id),
    ]);
    const file = `dati-${email.split("@")[0]}.json`;
    writeFileSync(file, JSON.stringify({ generato_il: new Date().toISOString(), profilo: student, prenotazioni: bookings.data, liste_attesa: waits.data, comunicazioni: deliveries.data }, null, 2));
    console.log(`Dati salvati in ${file}. Consegnalo all'interessato e poi eliminalo.`);
    return;
  }

  if (command === "erase") {
    if (!values.conferma) {
      console.log(`Verrebbero cancellati definitivamente i dati di ${student.first_name ?? ""} ${student.last_name ?? ""} (${email}). Ripeti con --conferma.`);
      return;
    }
    const { data, error } = await db.rpc("erase_student", { p_student_id: student.id });
    if (error) throw new Error(error.message);
    console.log("Cancellazione completata:", data);
    return;
  }
  throw new Error("Comando: export | erase | purge");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
