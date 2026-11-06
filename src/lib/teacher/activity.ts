import type { ActivityEntry } from "./types";

/** Categorie del registro delle operazioni (filtri della pagina Registro). */
export const ACTIVITY_CATEGORIES = {
  giornate: "Aperture e chiusure",
  orari: "Orari",
  prenotazioni: "Annullamenti manuali",
  comunicazioni: "Comunicazioni",
  impostazioni: "Impostazioni e lista d'attesa",
} as const;
export type ActivityCategory = keyof typeof ACTIVITY_CATEGORIES;

const dayLabel = (v: unknown) =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)
    ? new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${v}T12:00:00Z`))
    : "";
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export type DescribedActivity = { category: ActivityCategory; title: string; detail?: string; tone: "neutral" | "gold" | "danger" | "success" };

/** Trasforma una voce tecnica del registro in una frase leggibile. */
export function describeActivity(e: ActivityEntry): DescribedActivity {
  const d = e.details;
  const day = dayLabel(d.day);
  switch (e.action) {
    case "giornata_chiusa": {
      const notice = d.comunicazione === "none" ? "nessuna email" : `${plural(Number(d.destinatari ?? 0), "email", "email")} ${d.comunicazione === "custom" ? "personalizzate" : "automatiche"}`;
      return {
        category: "giornate",
        tone: "danger",
        title: `Chiusa la giornata di ${day}`,
        detail: `Motivo: ${s(d.motivo)} · ${plural(Number(d.prenotati ?? 0), "prenotato", "prenotati")}, ${Number(d.in_attesa ?? 0)} in lista · ${notice}`,
      };
    }
    case "giornata_riaperta":
      return { category: "giornate", tone: "success", title: `Riaperta la giornata di ${day}`, detail: d.motivo_precedente ? `Era chiusa per: ${s(d.motivo_precedente)}` : undefined };
    case "orario_giornata":
    case "giornata_modificata": {
      const parts: string[] = [];
      const o = d.orario as { da?: string; a?: string } | undefined;
      const c = d.capienza as { da?: number; a?: number } | undefined;
      const n = d.nota as { da?: string; a?: string } | undefined;
      if (o) parts.push(`orario ${s(o.da)} → ${s(o.a)}`);
      if (c) parts.push(`capienza ${s(c.da)} → ${s(c.a)}`);
      if (n) parts.push(n.a ? `nota: “${s(n.a)}”` : "nota rimossa");
      return { category: o ? "orari" : "giornate", tone: "neutral", title: `${o ? "Orario modificato" : "Giornata modificata"}: ${day}`, detail: parts.join(" · ") };
    }
    case "orario_generale":
      return { category: "orari", tone: "neutral", title: `Orario di apertura: ${s(d.da)} → ${s(d.a)}`, detail: `Applicato a ${plural(Number(d.giornate ?? 0), "giornata futura", "giornate future")}` };
    case "prenotazione_annullata":
      return {
        category: "prenotazioni",
        tone: "danger",
        title: `Annullata la prenotazione di ${s(d.studente)}${d.classe ? ` (${s(d.classe)})` : ""}`,
        detail: `${day} · Motivo: ${s(d.motivo)}${d.email === false ? " · senza email" : " · studente avvisato"}`,
      };
    case "comunicazione_inviata": {
      const who = [d.prenotati ? "prenotati" : "", d.lista_attesa ? "lista d'attesa" : ""].filter(Boolean).join(" e ");
      return { category: "comunicazioni", tone: "gold", title: `Comunicazione “${s(d.subject)}”`, detail: `${day} · ${plural(Number(d.recipients ?? 0), "destinatario", "destinatari")} (${who})` };
    }
    case "comunicazione_reinvio":
      return { category: "comunicazioni", tone: "gold", title: "Nuovo invio delle email non recapitate", detail: plural(Number(d.email ?? 0), "email rimessa in coda", "email rimesse in coda") };
    case "impostazioni": {
      const fmt = (m: unknown) => {
        const n = Number(m);
        const h = Math.floor(n / 60);
        return h ? `${h} h${n % 60 ? ` ${n % 60} min` : ""}` : `${n} min`;
      };
      return { category: "impostazioni", tone: "neutral", title: `Impostazione modificata: ${s(d.impostazione)}`, detail: `${fmt(d.da)} → ${fmt(d.a)}` };
    }
    case "lista_sospesa":
      return { category: "impostazioni", tone: "neutral", title: `Lista d'attesa sospesa per ${day}` };
    case "lista_riattivata":
      return { category: "impostazioni", tone: "neutral", title: `Lista d'attesa riattivata per ${day}` };
    case "lista_rimozione":
      return { category: "impostazioni", tone: "neutral", title: `${s(d.studente)} rimosso dalla lista d'attesa`, detail: day };
    default:
      return { category: "impostazioni", tone: "neutral", title: e.action.replace(/_/g, " ") };
  }
}
