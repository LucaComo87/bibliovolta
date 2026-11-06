import { FlaskConical } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/config";
import { formatDayMedium } from "@/lib/dates";
import { DEMO_TODAY } from "@/lib/demo/data";

/** Fascia che distingue chiaramente l'anteprima dai dati reali. */
export function DemoBanner() {
  return (
    <div role="note" className="relative z-40 border-b border-gold/40 bg-gold-soft text-wood">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 text-[13px] sm:px-6">
        <p className="flex items-center gap-2 font-semibold">
          <FlaskConical className="size-4 shrink-0" />
          Anteprima con dati dimostrativi
          <span className="hidden font-normal sm:inline">· nomi e numeri inventati, nulla viene salvato · data simulata: {formatDayMedium(DEMO_TODAY)}</span>
        </p>
        <Link href={ROUTES.preview} className="font-semibold underline underline-offset-4">Tutte le schermate</Link>
      </div>
    </div>
  );
}
