import { APP } from "@/lib/config";
import { cn } from "@/lib/cn";

/** Riconoscimento dell'autore, in fondo a ogni pagina. */
export function AppCredit({ tone = "dark", className }: { tone?: "dark" | "light"; className?: string }) {
  return (
    <p className={cn("text-center text-xs", tone === "light" ? "text-white/60" : "text-muted", className)} data-testid="app-credit">
      {APP.credit}
    </p>
  );
}
