import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "blue" | "success" | "warning" | "danger" | "gold" | "wood";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-ink/[0.06] text-muted",
  blue: "bg-blue-50 text-ink",
  success: "bg-ok-soft text-ok",
  warning: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  gold: "bg-gold-soft text-wood",
  wood: "bg-wood-soft text-wood",
};

export function Badge({
  children,
  tone = "neutral",
  icon,
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap [&_svg]:size-3.5",
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
