import { cn } from "@/lib/cn";
import { SchoolLogo } from "./SchoolLogo";

/**
 * Marchio BIBLIOVOLTA: l'arco della volta della biblioteca storica
 * (oro) che racchiude i dorsi dei libri (bianco), su blu istituzionale.
 */
export function BrandMark({ className, tone = "solid" }: { className?: string; tone?: "solid" | "light" }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <rect width="64" height="64" rx="14" fill={tone === "solid" ? "var(--ink)" : "rgb(255 255 255 / 0.12)"} />
      <path d="M16 50V30a16 16 0 0 1 32 0v20" fill="none" stroke="var(--gold)" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M22 50h20" stroke="var(--gold)" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M27 26v18M32 24v20M37 26v18" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function BrandLockup({ tone = "dark", compact = false }: { tone?: "dark" | "light"; compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      {/* logo ufficiale della scuola accanto al nome della piattaforma */}
      <SchoolLogo size={38} />
      <span className="leading-none">
        <span
          className={cn(
            "block font-display text-[1.05rem] font-bold tracking-[0.14em]",
            tone === "light" ? "text-white" : "text-ink",
          )}
        >
          BIBLIOVOLTA
        </span>
        {!compact && (
          <span className={cn("mt-1 block text-[11px]", tone === "light" ? "text-white/70" : "text-muted")}>
            Liceo A. Volta · Como
          </span>
        )}
      </span>
    </span>
  );
}
