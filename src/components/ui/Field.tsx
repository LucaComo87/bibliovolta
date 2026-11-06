import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

const inputBase =
  "w-full rounded-[10px] border border-line bg-surface text-[0.95rem] text-ink shadow-[inset_0_1px_1px_rgb(15_35_80/0.04)] " +
  "placeholder:text-muted/70 transition focus:border-ink-soft focus:outline-none focus:ring-4 focus:ring-blue-100";

export function TextInput({ icon, className, ...props }: ComponentProps<"input"> & { icon?: ReactNode }) {
  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted [&_svg]:size-4">{icon}</span>
      )}
      <input className={cn(inputBase, "h-11", icon ? "pl-9 pr-3" : "px-3", className)} {...props} />
    </div>
  );
}

export function TextArea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(inputBase, "min-h-28 px-3 py-2.5", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(inputBase, "h-11 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%235b6680%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pl-3 pr-9", className)} {...props}>
      {children}
    </select>
  );
}

export function Toggle({ id, checked, onChange, label }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-3">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <span className="relative inline-flex">
        <input id={id} type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-ink/15 transition peer-checked:bg-ok peer-focus-visible:ring-4 peer-focus-visible:ring-blue-100" />
        <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
