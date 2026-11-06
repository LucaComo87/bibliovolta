import { cn } from "@/lib/cn";

/** Istogramma verticale con scala fissa (es. 0–100 %). */
export function BarChart({
  data,
  max = 100,
  unit = "%",
  highlightLast = false,
  ariaLabel,
}: {
  data: { label: string; value: number }[];
  max?: number;
  unit?: string;
  highlightLast?: boolean;
  ariaLabel: string;
}) {
  const ticks = [0, 25, 50, 75, 100].map((t) => (t / 100) * max);
  return (
    <figure aria-label={ariaLabel}>
      <div className="relative h-52 pl-9">
        {ticks.map((t) => (
          <div key={t} className="absolute inset-x-0 flex items-center" style={{ bottom: `${(t / max) * 100}%` }}>
            <span className="w-8 -translate-y-px pr-2 text-right text-[10px] text-muted tabular">{t}{unit}</span>
            <span className="h-px flex-1 bg-line" />
          </div>
        ))}
        <div className="relative flex h-full items-end gap-2 pl-0 sm:gap-4">
          {data.map((d, i) => {
            const strong = highlightLast ? i === data.length - 1 : d.value === Math.max(...data.map((x) => x.value));
            return (
              <div key={d.label} className="group flex h-full flex-1 flex-col justify-end">
                <span className="mb-1 text-center text-[11px] font-semibold text-ink opacity-0 transition group-hover:opacity-100 tabular sm:opacity-100">
                  {d.value}{unit}
                </span>
                <div
                  className={cn(
                    "origin-bottom animate-rise rounded-t-md transition",
                    strong ? "bg-ink" : "bg-ink/25 group-hover:bg-ink/40",
                  )}
                  style={{ height: `${(d.value / max) * 100}%`, animationDelay: `${i * 60}ms` }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex gap-2 pl-9 sm:gap-4">
        {data.map((d) => (
          <span key={d.label} className="flex-1 text-center text-[11px] text-muted">{d.label}</span>
        ))}
      </div>
    </figure>
  );
}

/** Barre orizzontali per classifiche. */
export function HBarList({ data, unit = "", labelWidth = "3rem" }: { data: { label: string; value: number; hint?: string }[]; unit?: string; labelWidth?: string }) {
  const top = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="space-y-3">
      {data.map((d, i) => (
        <li key={d.label} className="grid items-center gap-3 text-sm" style={{ gridTemplateColumns: `${labelWidth} 1fr 3.5rem` }} title={d.hint}>
          <span className="truncate font-semibold text-ink first-letter:uppercase">{d.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-ink/[0.06]">
            <span className={cn("block h-full rounded-full", i === 0 ? "bg-gold" : "bg-wood/50")} style={{ width: `${(d.value / top) * 100}%` }} />
          </span>
          <span className="text-right text-muted tabular">{d.value}{unit}</span>
        </li>
      ))}
    </ul>
  );
}
