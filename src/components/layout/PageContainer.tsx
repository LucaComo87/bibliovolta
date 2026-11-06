import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cn("mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12", className)}>{children}</main>;
}
