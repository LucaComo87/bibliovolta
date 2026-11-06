import { CircleAlert, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "info" | "warning" | "danger";

const tones: Record<Tone, { box: string; icon: ReactNode }> = {
  info: { box: "border-blue-100 bg-blue-50 text-ink", icon: <Info /> },
  warning: { box: "border-gold/40 bg-gold-soft/60 text-wood", icon: <TriangleAlert /> },
  danger: { box: "border-danger/30 bg-danger-soft text-danger", icon: <CircleAlert /> },
};

export function Notice({ title, children, tone = "info", className }: { title?: string; children: ReactNode; tone?: Tone; className?: string }) {
  const t = tones[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-xl border p-4 text-sm [&>svg]:mt-0.5 [&>svg]:size-[18px] [&>svg]:shrink-0", t.box, className)}
    >
      {t.icon}
      <div className="min-w-0">
        {title && <p className="mb-0.5 font-semibold">{title}</p>}
        <div className="opacity-90">{children}</div>
      </div>
    </div>
  );
}
