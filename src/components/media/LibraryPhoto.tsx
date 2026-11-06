import Image from "next/image";
import type { ReactNode } from "react";
import library from "@/assets/biblioteca-volta.jpg";
import panorama from "@/assets/biblioteca-volta-panorama.jpg";
import { cn } from "@/lib/cn";

/**
 * Fotografia della biblioteca storica del Liceo Volta, elemento
 * distintivo della piattaforma. Ottimizzata da next/image (AVIF/WebP,
 * dimensioni adatte allo schermo, segnaposto sfocato).
 *
 * L'overlay garantisce la leggibilità dei testi sovrapposti.
 */
type Overlay = "hero" | "login" | "banner" | "soft";

const overlays: Record<Overlay, string> = {
  // blu dal basso e da sinistra: testo bianco leggibile, volta e stemma visibili in alto
  hero: "bg-[linear-gradient(180deg,rgb(15_35_80/0.3)_0%,rgb(15_35_80/0.7)_38%,rgb(11_26_61/0.95)_75%)] sm:bg-[linear-gradient(100deg,rgb(11_26_61/0.9)_0%,rgb(15_35_80/0.62)_42%,rgb(15_35_80/0.08)_100%)]",
  login: "bg-[linear-gradient(180deg,rgb(11_26_61/0.3)_0%,rgb(11_26_61/0.55)_55%,rgb(11_26_61/0.88)_100%)]",
  banner: "bg-[linear-gradient(90deg,rgb(11_26_61/0.9)_0%,rgb(15_35_80/0.6)_55%,rgb(15_35_80/0.2)_100%)]",
  soft: "bg-[linear-gradient(180deg,rgb(15_35_80/0.15),rgb(15_35_80/0.55))]",
};

export function LibraryBackdrop({
  overlay = "hero",
  source = "full",
  position = "50% 30%",
  priority = false,
  sizes = "100vw",
  className,
  children,
}: {
  overlay?: Overlay;
  source?: "full" | "panorama";
  position?: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("relative isolate overflow-hidden bg-ink", className)}>
      <Image
        src={source === "full" ? library : panorama}
        alt="La biblioteca storica del Liceo A. Volta di Como: volta affrescata con lo stemma, ballatoio in legno e scaffali antichi"
        fill
        priority={priority}
        placeholder="blur"
        sizes={sizes}
        className="-z-20 object-cover"
        style={{ objectPosition: position }}
      />
      <div aria-hidden className={cn("absolute inset-0 -z-10", overlays[overlay])} />
      {children}
    </div>
  );
}
