/** Modelli pronti per le comunicazioni dei docenti (testo modificabile prima dell'invio). */
export type AnnouncementCategory = "annullamento" | "modifica_orario" | "chiusura_straordinaria" | "avviso_urgente" | "altro";

export const ANNOUNCEMENT_TEMPLATES: { category: Exclude<AnnouncementCategory, "altro">; label: string; subject: string; body: (day: string, hours: string) => string }[] = [
  {
    category: "annullamento",
    label: "Annullamento",
    subject: "Apertura dell'aula studio annullata",
    body: (day) =>
      `ti informiamo che l'apertura dell'aula studio prevista per ${day} è stata annullata.\n\nCi scusiamo per il disagio. Puoi prenotare un'altra giornata dal calendario.`,
  },
  {
    category: "modifica_orario",
    label: "Modifica orario",
    subject: "Cambio di orario dell'aula studio",
    body: (day, hours) =>
      `ti informiamo che ${day} l'aula studio seguirà un orario diverso dal solito: ${hours}.\n\nLa tua prenotazione resta valida.`,
  },
  {
    category: "chiusura_straordinaria",
    label: "Chiusura straordinaria",
    subject: "Chiusura straordinaria dell'aula studio",
    body: (day) =>
      `per motivi organizzativi l'aula studio resterà chiusa ${day}.\n\nCi scusiamo per il disagio: puoi prenotare un'altra giornata dal calendario.`,
  },
  {
    category: "avviso_urgente",
    label: "Avviso urgente",
    subject: "Avviso urgente sull'aula studio",
    body: (day) => `ti scriviamo con un avviso importante per la giornata di ${day}:\n\n`,
  },
];
