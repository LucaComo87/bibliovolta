import Link from "next/link";
import { BrandLockup } from "@/components/brand/BrandMark";
import { APP, CALENDAR, ROUTES } from "@/lib/config";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm sm:grid-cols-[1.5fr_1fr_1fr] sm:px-6">
        <div className="space-y-3">
          <BrandLockup />
          <p className="max-w-xs text-muted">
            {APP.tagline} del {APP.school} di {APP.city}. Dal lunedì al venerdì, {CALENDAR.opensAt}–{CALENDAR.closesAt}.
          </p>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-wood">Accesso</p>
          <ul className="space-y-1.5 text-muted">
            <li><Link className="hover:text-ink" href={ROUTES.login}>Studenti</Link></li>
            <li><Link className="hover:text-ink" href={ROUTES.teacherLogin}>Docenti</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-wood">Servizio</p>
          <ul className="space-y-1.5 text-muted">
            <li><Link className="hover:text-ink" href="/#informazioni">Regole di prenotazione</Link></li>
            <li><Link className="hover:text-ink" href={ROUTES.privacy}>Informativa privacy</Link></li>
            <li><Link className="hover:text-ink" href={ROUTES.status}>Stato del sistema</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted sm:px-6">
          © {APP.school} · {APP.city}
        </p>
      </div>
    </footer>
  );
}
