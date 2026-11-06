import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDayLong } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRoster } from "@/lib/teacher/data";

/**
 * Esportazione dell'elenco iscritti di una giornata.
 * GET /docenti/iscritti/esporta?giorno=YYYY-MM-DD&formato=csv|xlsx
 * Solo docenti: il ruolo è verificato qui e dalle regole RLS del database.
 */
const TZ = "Europe/Rome";
const date = (iso: string) => new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ }).format(new Date(iso));
const time = (iso: string) => new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: TZ }).format(new Date(iso));
const coll = new Intl.Collator("it", { sensitivity: "base" });
/** evita che Excel interpreti i valori come formule */
const safe = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
const csvCell = (v: string) => `"${safe(v).replace(/"/g, '""')}"`;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "teacher" || user.mustChangePassword) return new Response("Operazione riservata ai docenti.", { status: 403 });
  const url = new URL(request.url);
  const day = url.searchParams.get("giorno") ?? "";
  const format = url.searchParams.get("formato") === "xlsx" ? "xlsx" : "csv";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return new Response("Giornata non valida.", { status: 400 });

  const supabase = await createSupabaseServerClient();
  const roster = await getRoster(supabase, day);
  if (!roster.day || roster.day.day !== day) return new Response("Giornata inesistente.", { status: 404 });
  const rows = [...roster.rows].sort((a, b) => coll.compare(a.lastName, b.lastName) || coll.compare(a.firstName, b.firstName));
  const header = ["Cognome", "Nome", "Classe", "Email", "Data prenotazione", "Ora prenotazione"];
  const values = rows.map((r) => [r.lastName, r.firstName, r.className ?? "", r.email, date(r.bookedAt), time(r.bookedAt)]);
  const name = `bibliovolta-iscritti-${day}`;
  const headers = { "cache-control": "no-store", "x-content-type-options": "nosniff" };

  if (format === "csv") {
    // BOM + punto e virgola: si apre correttamente in Excel con impostazioni italiane
    const csv = "﻿" + [header, ...values].map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
    return new Response(csv, {
      headers: { ...headers, "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}.csv"` },
    });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "BIBLIOVOLTA";
  wb.created = new Date();
  const ws = wb.addWorksheet("Iscritti", { views: [{ state: "frozen", ySplit: 3 }] });
  ws.mergeCells("A1:F1");
  ws.getCell("A1").value = `Aula studio · ${formatDayLong(day)} · ${roster.day.opensAt}–${roster.day.closesAt}`;
  ws.getCell("A1").font = { bold: true, size: 14, color: { argb: "FF0F2350" } };
  ws.getCell("A2").value = `${rows.length} prenotati su ${roster.day.capacity} posti`;
  ws.getCell("A2").font = { italic: true, color: { argb: "FF5B6680" } };
  ws.addRow(header);
  const head = ws.getRow(3);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F2350" } };
  });
  values.forEach((v) => ws.addRow(v.map(safe)));
  ws.columns = [{ width: 20 }, { width: 18 }, { width: 9 }, { width: 38 }, { width: 18 }, { width: 16 }];
  ws.autoFilter = { from: "A3", to: `F${3 + rows.length}` };
  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      ...headers,
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${name}.xlsx"`,
    },
  });
}
