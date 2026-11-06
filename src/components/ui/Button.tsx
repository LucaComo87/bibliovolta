import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "gold" | "secondary" | "ghost" | "light" | "outline-light" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold whitespace-nowrap " +
  "transition-[background-color,box-shadow,transform,color,border-color] duration-200 " +
  "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[1.1em] [&_svg]:shrink-0";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-ink text-white shadow-soft hover:bg-ink-soft hover:shadow-lift",
  gold: "bg-gold text-ink shadow-soft hover:brightness-105 hover:shadow-lift",
  secondary: "border border-line bg-surface text-ink shadow-soft hover:border-ink/30",
  ghost: "text-ink hover:bg-ink/5",
  light: "bg-white text-ink shadow-soft hover:bg-blue-50",
  "outline-light": "border border-white/60 bg-white/5 text-white backdrop-blur-sm hover:bg-white/15",
  danger: "border border-danger/30 bg-surface text-danger hover:bg-danger-soft",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-13 px-6 text-[0.95rem] tracking-wide",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type CommonProps = { variant?: ButtonVariant; size?: ButtonSize };

export function Button({ variant, size, className, type = "button", ...props }: ComponentProps<"button"> & CommonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}

export function ButtonLink({
  href,
  variant,
  size,
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof Link>, "className"> & CommonProps & { className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={buttonClasses(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}
