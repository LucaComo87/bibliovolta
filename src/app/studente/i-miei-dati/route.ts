import { getCurrentUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Diritto di accesso (art. 15 GDPR): lo studente scarica i propri dati in
 * formato JSON. Il database restituisce solo i dati di chi è collegato.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") return new Response("Accesso riservato agli studenti.", { status: 403 });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("export_my_data");
  if (error) return new Response("Esportazione non disponibile.", { status: 500 });
  const day = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="bibliovolta-i-miei-dati-${day}.json"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
