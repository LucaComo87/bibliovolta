import Image from "next/image";
import logo from "@/assets/logo-liceo-volta.png";
import { cn } from "@/lib/cn";

/**
 * Logo ufficiale del Liceo A. Volta di Como.
 * Va sempre su fondo bianco: su sfondi scuri (fotografia, barra laterale)
 * viene racchiuso in una piastrina bianca per restare fedele ai colori.
 */
export function SchoolLogo({
  size = 36,
  tile = true,
  className,
  priority = false,
}: {
  /** altezza della piastrina (o del logo, se tile=false) in px */
  size?: number;
  tile?: boolean;
  className?: string;
  priority?: boolean;
}) {
  const logoHeight = tile ? Math.round(size * 0.78) : size;
  const img = (
    <Image
      src={logo}
      alt="Logo del Liceo A. Volta di Como"
      height={logoHeight}
      style={{ height: logoHeight, width: "auto" }}
      priority={priority}
      sizes={`${Math.round((logoHeight * logo.width) / logo.height) * 2}px`}
    />
  );
  if (!tile) return <span className={cn("inline-flex shrink-0", className)}>{img}</span>;
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center rounded-[10px] bg-white shadow-soft ring-1 ring-black/5", className)}
      style={{ height: size, width: size }}
    >
      {img}
    </span>
  );
}
