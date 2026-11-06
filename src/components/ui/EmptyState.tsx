import type { ReactNode } from "react";

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-line bg-surface/60 px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-gold-soft text-wood [&_svg]:size-6">{icon}</span>
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      {children && <p className="max-w-sm text-sm text-muted">{children}</p>}
      {action}
    </div>
  );
}
