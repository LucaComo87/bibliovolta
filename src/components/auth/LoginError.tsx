"use client";

import { useSearchParams } from "next/navigation";
import { Notice } from "@/components/ui/Notice";
import { AUTH } from "@/lib/config";

const MESSAGES: Record<string, string> = {
  codice_mancante: "Il collegamento di accesso non è valido. Riprova.",
  accesso_non_riuscito: "Non è stato possibile completare l'accesso. Riprova tra qualche istante.",
  account_non_autorizzato: `Questo account non è autorizzato. Accedi con il tuo account della scuola @${AUTH.studentEmailDomain}: account Gmail personali e di altri domini non sono ammessi.`,
  accesso_annullato: "Hai annullato l'accesso con Google.",
  docente_usa_password: "I docenti accedono con email e password dall'area docenti, non con Google.",
  sessione_scaduta: "La sessione è scaduta. Accedi di nuovo.",
  non_configurato: "Il servizio di accesso non è ancora configurato. Contatta l'amministratore.",
};

/** Mostra l'errore restituito dal ritorno OAuth (/auth/callback?…). */
export function LoginError() {
  const code = useSearchParams().get("errore");
  if (!code) return null;
  return (
    <Notice tone="danger" title="Accesso non riuscito">
      {MESSAGES[code] ?? "Si è verificato un errore durante l'accesso."}
    </Notice>
  );
}
