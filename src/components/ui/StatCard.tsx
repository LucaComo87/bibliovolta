import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function StatCard({
  label,
  value,
  hint,
  icon,
  trend,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  trend?: { value: string; positive?: boolean };
  className?: string;
}) {
  return (
    <div className={cn("rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-soft sm:p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">{label}</p>
        {icon && <span className="text-gold [&_svg]:size-[18px]">{icon}</span>}
      </div>
      <p className="mt-2 font-display text-3xl font-semibold text-ink tabular">{value}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
        {trend && (
          <span className={cn("font-semibold", trend.positive ? "text-ok" : "text-danger")}>{trend.value}</span>
        )}
        {hint}
      </div>
    </div>
  );
}
