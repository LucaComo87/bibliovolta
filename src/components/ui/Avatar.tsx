import { cn } from "@/lib/cn";

/** Iniziali su fondo blu, con filetto dorato. */
export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  const sizes = { sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-14 text-lg" };
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-ink font-semibold text-white ring-2 ring-gold/60 ring-offset-2 ring-offset-surface",
        sizes[size],
        className,
      )}
    >
      {initials || "?"}
    </span>
  );
}
