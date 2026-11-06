import { LogIn } from "lucide-react";
import Link from "next/link";
import { BrandLockup } from "@/components/brand/BrandMark";
import { buttonClasses } from "@/components/ui/Button";
import { ROUTES } from "@/lib/config";
import { cn } from "@/lib/cn";

/** Intestazione pubblica. "overlay" si appoggia sulla fotografia della homepage. */
export function SiteHeader({ variant = "solid" }: { variant?: "solid" | "overlay" }) {
  const overlay = variant === "overlay";
  return (
    <header
      className={cn(
        "z-30 w-full",
        overlay ? "absolute inset-x-0 top-0" : "sticky top-0 border-b border-line bg-surface/85 backdrop-blur-md",
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href={ROUTES.home} aria-label="BIBLIOVOLTA, pagina iniziale">
          <BrandLockup tone={overlay ? "light" : "dark"} />
        </Link>
        <nav aria-label="Navigazione principale" className="flex items-center gap-1 text-sm">
          <Link
            href="/#come-funziona"
            className={cn(
              "hidden rounded-lg px-3 py-2 font-medium sm:block",
              overlay ? "text-white/85 hover:bg-white/10 hover:text-white" : "text-muted hover:bg-ink/5 hover:text-ink",
            )}
          >
            Come funziona
          </Link>
          <Link
            href="/#informazioni"
            className={cn(
              "hidden rounded-lg px-3 py-2 font-medium sm:block",
              overlay ? "text-white/85 hover:bg-white/10 hover:text-white" : "text-muted hover:bg-ink/5 hover:text-ink",
            )}
          >
            Informazioni
          </Link>
          <Link href={ROUTES.login} className={buttonClasses(overlay ? "outline-light" : "secondary", "sm", "ml-1")}>
            <LogIn /> Accedi
          </Link>
        </nav>
      </div>
    </header>
  );
}
