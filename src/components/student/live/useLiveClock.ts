"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Ora corrente aggiornata ogni 30 secondi (per disattivare i pulsanti alla
 * scadenza) e ricarica dei dati dal server quando la pagina torna visibile
 * o ogni `refreshMs`: i posti liberi seguono le prenotazioni degli altri.
 */
export function useLiveClock(initialNowIso: string, refreshMs = 30_000) {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date(initialNowIso));

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30_000);
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, refreshMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setNow(new Date());
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [router, refreshMs]);

  return now;
}
