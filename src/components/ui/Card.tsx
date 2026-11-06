import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({
  children,
  className,
  as: Tag = "section",
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "article" | "div" | "li";
  interactive?: boolean;
}) {
  return (
    <Tag
      className={cn(
        "rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-soft sm:p-6",
        interactive && "transition duration-200 hover:-translate-y-0.5 hover:shadow-lift",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function CardTitle({
  children,
  eyebrow,
  action,
  icon,
}: {
  children: ReactNode;
  eyebrow?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-ink [&_svg]:size-[18px]">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-wood">{eyebrow}</p>}
          <h2 className="font-display text-lg font-semibold text-ink text-balance">{children}</h2>
        </div>
      </div>
      {action}
    </header>
  );
}
