import { Badge } from "@/components/ui/Badge";
import { Card, CardTitle } from "@/components/ui/Card";
import { formatDayLong } from "@/lib/dates";
import { getSystemHealth } from "@/lib/health";

const LABELS: Record<string, string> = {
  supabaseUrl: "URL progetto Supabase",
  supabasePublicKey: "Chiave pubblica Supabase",
  supabaseServiceRole: "Chiave service role (solo server)",
  resendApiKey: "Chiave API Resend",
  emailFrom: "Mittente email",
  siteUrl: "Indirizzo pubblico del sito",
};

export async function SystemStatus() {
  const health = await getSystemHealth();
  const { database } = health;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardTitle eyebrow="Configurazione">Variabili d&apos;ambiente</CardTitle>
        <ul className="divide-y divide-line text-sm">
          {Object.entries(health.config).map(([key, present]) => (
            <li key={key} className="flex items-center justify-between py-2">
              <span>{LABELS[key] ?? key}</span>
              <Badge tone={present ? "success" : "warning"}>{present ? "presente" : "mancante"}</Badge>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardTitle eyebrow="Database">Supabase</CardTitle>
        {database.reachable ? (
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt>Connessione</dt><dd><Badge tone="success">attiva</Badge></dd></div>
            <div className="flex justify-between"><dt>Giornate in calendario</dt><dd className="font-semibold">{database.schoolDays}</dd></div>
            <div className="flex justify-between"><dt>Giornate aperte</dt><dd className="font-semibold">{database.openDays}</dd></div>
            {database.seasonStart && database.seasonEnd && (
              <div className="pt-2 text-muted">
                Stagione: {formatDayLong(database.seasonStart)} → {formatDayLong(database.seasonEnd)}
              </div>
            )}
          </dl>
        ) : (
          <div className="space-y-2 text-sm">
            <Badge tone="danger">non raggiungibile</Badge>
            <p className="text-muted">{database.error}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
