import type { ReactNode } from "react";

export function PageHeading({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 animate-rise">
        {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-wood">{eyebrow}</p>}
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight text-ink text-balance sm:text-4xl">{title}</h1>
        {children && <div className="mt-2 max-w-2xl text-[0.95rem] text-muted">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
