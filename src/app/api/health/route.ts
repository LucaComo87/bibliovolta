import { NextResponse, connection } from "next/server";
import { getSystemHealth } from "@/lib/health";

/** Stato del sistema in JSON (per /stato e per il monitoraggio su Vercel). */
export async function GET() {
  await connection();
  const health = await getSystemHealth();
  return NextResponse.json(health, {
    status: health.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
