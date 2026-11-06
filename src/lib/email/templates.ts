import type { NotificationKind } from "@/lib/database.types";

/**
 * Testi delle email della lista d'attesa e delle chiusure.
 * HTML semplice con stili in linea (compatibile con i client di posta)
 * e versione solo testo.
 */
type Payload = Record<string, unknown>;

const TZ = "Europe/Rome";
const dayLong = (day: string) =>
  new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
const dateTime = (iso: string) =>
  new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso));
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, body: string, siteUrl: string) {
  return `<!doctype html><html lang="it"><body style="margin:0;background:#f5f6f9;font-family:Arial,Helvetica,sans-serif;color:#0f2350">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;border:1px solid #e3e7f0">
<tr><td style="background:#0f2350;border-radius:14px 14px 0 0;padding:18px 24px;color:#ffffff;font-weight:bold;letter-spacing:3px;font-size:15px">BIBLIOVOLTA<span style="display:block;letter-spacing:0;font-weight:normal;font-size:12px;color:#c39a45;margin-top:2px">Aula studio · Liceo A. Volta di Como</span></td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 12px;font-size:21px;font-family:Georgia,serif;color:#0f2350">${esc(title)}</h1>
${body}
</td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid #e3e7f0;font-size:12px;color:#5b6680">Messaggio automatico di BIBLIOVOLTA · <a href="${esc(siteUrl)}" style="color:#5b6680">${esc(siteUrl.replace(/^https?:\/\//, ""))}</a></td></tr>
</table></td></tr></table></body></html>`;
}

const p = (t: string) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${t}</p>`;
const button = (href: string, label: string) =>
  `<p style="margin:20px 0"><a href="${esc(href)}" style="display:inline-block;background:#c39a45;color:#0f2350;text-decoration:none;font-weight:bold;padding:13px 22px;border-radius:10px">${esc(label)}</a></p>`;
const box = (t: string) => `<p style="margin:0 0 12px;padding:12px 14px;background:#eef2fb;border-radius:10px;font-size:15px">${t}</p>`;

export type RenderedEmail = { subject: string; html: string; text: string };

export function renderNotification(kind: NotificationKind, payload: Payload, siteUrl: string): RenderedEmail {
  const name = esc(payload.first_name || "");
  const day = typeof payload.day === "string" ? dayLong(payload.day) : "";
  const hours = payload.opens_at ? `${payload.opens_at}–${payload.closes_at}` : "";
  const area = `${siteUrl}/studente/attesa`;

  switch (kind) {
    case "waitlist_offer": {
      const link = `${siteUrl}/proposta/${payload.token}`;
      const until = dateTime(String(payload.expires_at));
      return {
        subject: `Si è liberato un posto per ${day}`,
        html: layout(
          "Si è liberato un posto per te",
          p(`Ciao ${name},`) +
            p(`sei il primo in lista d'attesa e si è liberato un posto nell'aula studio per <strong>${esc(day)}</strong> (${esc(hours)}).`) +
            box(`Conferma entro <strong>${esc(until)}</strong>. Dopo quell'ora il posto passa allo studente successivo.`) +
            button(link, "Conferma il posto") +
            p(`Il link è personale e vale una sola volta: non inoltrarlo. Se non ti serve più, dalla stessa pagina puoi rinunciare.`),
          siteUrl,
        ),
        text: `Ciao ${payload.first_name ?? ""},\nsi è liberato un posto per ${day} (${hours}).\nConferma entro ${until}: ${link}\nIl link è personale e vale una sola volta.`,
      };
    }
    case "offer_confirmed": {
      const deadline = payload.cancel_deadline ? dateTime(String(payload.cancel_deadline)) : "";
      return {
        subject: `Posto confermato per ${day}`,
        html: layout(
          "Posto confermato",
          p(`Ciao ${name},`) +
            p(`il tuo posto nell'aula studio è confermato per <strong>${esc(day)}</strong>, ${esc(hours)}.`) +
            (deadline ? box(`Se non puoi venire, annulla entro ${esc(deadline)} dall'area personale.`) : "") +
            button(`${siteUrl}/studente/prenotazioni`, "Le mie prenotazioni"),
          siteUrl,
        ),
        text: `Ciao ${payload.first_name ?? ""},\nil tuo posto è confermato per ${day}, ${hours}.\n${deadline ? `Puoi annullare entro ${deadline}.` : ""}`,
      };
    }
    case "offer_expired":
      return {
        subject: `Proposta scaduta per ${day}`,
        html: layout(
          "La proposta è scaduta",
          p(`Ciao ${name},`) +
            p(`il posto per <strong>${esc(day)}</strong> non è stato confermato in tempo ed è passato allo studente successivo in lista.`) +
            button(`${siteUrl}/studente/calendario`, "Apri il calendario"),
          siteUrl,
        ),
        text: `Ciao ${payload.first_name ?? ""},\nla proposta di posto per ${day} è scaduta senza conferma.`,
      };
    case "announcement": {
      const subject = String(payload.subject ?? "Comunicazione dall'aula studio");
      const body = esc(payload.body ?? "").replace(/\r?\n/g, "<br>");
      const author = payload.author ? `<p style="margin:16px 0 0;font-size:14px;color:#5b6680">${esc(payload.author)}<br>Aula studio · Liceo A. Volta</p>` : "";
      return {
        subject: `${subject}${day ? ` · ${day}` : ""}`,
        html: layout(
          subject,
          p(`Ciao ${name},`) +
            (day ? box(`Comunicazione per la giornata di <strong>${esc(day)}</strong>.`) : "") +
            `<div style="margin:0 0 12px;font-size:15px;line-height:1.55">${body}</div>` +
            author +
            button(`${siteUrl}/studente`, "Area personale"),
          siteUrl,
        ),
        text: `Ciao ${payload.first_name ?? ""},\n${day ? `Comunicazione per ${day}.\n` : ""}\n${payload.body ?? ""}\n\n${payload.author ?? ""}`,
      };
    }
    case "booking_cancelled": {
      const reason = esc(payload.reason ?? "");
      return {
        subject: `Prenotazione annullata per ${day}`,
        html: layout(
          "Prenotazione annullata",
          p(`Ciao ${name},`) +
            p(`la tua prenotazione dell'aula studio per <strong>${esc(day)}</strong> (${esc(hours)}) è stata annullata dai docenti.`) +
            (reason ? box(`Motivo: ${reason}`) : "") +
            p("Per chiarimenti rivolgiti ai docenti responsabili dell'aula studio.") +
            button(`${siteUrl}/studente/calendario`, "Apri il calendario"),
          siteUrl,
        ),
        text: `Ciao ${payload.first_name ?? ""},\nla tua prenotazione per ${day} è stata annullata dai docenti.${payload.reason ? ` Motivo: ${payload.reason}.` : ""}`,
      };
    }
    case "day_closed_booked":
    case "day_closed_waitlist": {
      const reason = payload.reason ? ` Motivo: ${esc(payload.reason)}.` : "";
      const who =
        kind === "day_closed_booked"
          ? "Avevi una prenotazione per questa giornata: non è necessario annullarla."
          : "Eri in lista d'attesa: la lista è sospesa finché la giornata resta chiusa.";
      return {
        subject: `Aula studio chiusa ${day}`,
        html: layout(
          "Aula studio chiusa",
          p(`Ciao ${name},`) + p(`l'aula studio resterà <strong>chiusa ${esc(day)}</strong>.${reason}`) + p(who) + button(area.replace("/attesa", ""), "Area personale"),
          siteUrl,
        ),
        text: `Ciao ${payload.first_name ?? ""},\nl'aula studio resterà chiusa ${day}.${payload.reason ? ` Motivo: ${payload.reason}.` : ""}\n${who}`,
      };
    }
  }
}
