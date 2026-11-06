/**
 * BIBLIOVOLTA · Server email di prova (SOLO TEST)
 * Risponde come l'API di Resend (POST /emails) e conserva i messaggi,
 * così i test possono leggere le email e seguire i link personali.
 * L'app lo usa impostando RESEND_BASE_URL.
 */
import http from "node:http";
import { randomUUID } from "node:crypto";

export async function startMockResend(port = 54400) {
  const messages = [];
  const rejected = [];
  const server = http.createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;
    if (req.method === "POST" && req.url?.endsWith("/emails")) {
      if (req.headers.authorization !== "Bearer re_test_key") {
        res.writeHead(401, { "content-type": "application/json" });
        return res.end(JSON.stringify({ name: "validation_error", message: "API key non valida" }));
      }
      const body = JSON.parse(raw || "{}");
      const to = [].concat(body.to).join(",");
      // indirizzi che contengono "rifiutata" simulano un rifiuto definitivo del servizio
      if (to.includes("rifiutata")) {
        rejected.push({ to, subject: body.subject, at: Date.now() });
        res.writeHead(422, { "content-type": "application/json" });
        return res.end(JSON.stringify({ statusCode: 422, name: "validation_error", message: "Indirizzo del destinatario non valido" }));
      }
      const id = randomUUID();
      messages.push({ id, to: [].concat(body.to).join(","), from: body.from, subject: body.subject, html: body.html, text: body.text, at: Date.now() });
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ id }));
    }
    res.writeHead(404).end();
  });
  await new Promise((ok) => server.listen(port, "127.0.0.1", ok));
  return {
    url: `http://127.0.0.1:${port}`,
    messages,
    rejected,
    /** Email ricevute da un indirizzo, opzionalmente filtrate per oggetto. */
    to(email, subjectPart) {
      return messages.filter((m) => m.to === email && (!subjectPart || m.subject.includes(subjectPart)));
    },
    async waitFor(email, subjectPart, timeout = 15000) {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const found = this.to(email, subjectPart);
        if (found.length) return found.at(-1);
        await new Promise((r) => setTimeout(r, 200));
      }
      return null;
    },
    stop: () => new Promise((ok) => server.close(ok)),
  };
}
