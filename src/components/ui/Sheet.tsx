"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Finestra di conferma: pannello dal basso su smartphone (raggiungibile
 * col pollice), finestra centrata su desktop. Esc o clic fuori per chiudere.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button aria-label="Chiudi finestra" tabIndex={-1} className="absolute inset-0 animate-fade bg-ink/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-[calc(100svh-1rem)] w-full animate-sheet overflow-y-auto overscroll-contain rounded-t-2xl bg-surface p-6 pb-safe shadow-lift sm:max-h-[calc(100svh-3rem)] sm:max-w-md sm:rounded-2xl"
      >
        <div aria-hidden className="mx-auto -mt-2 mb-4 h-1 w-10 rounded-full bg-line sm:hidden" />
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="font-display text-xl font-semibold text-ink">
            {title}
          </h2>
          <button onClick={onClose} className="-m-1 rounded-lg p-1 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Chiudi finestra">
            <X className="size-5" />
          </button>
        </div>
        <div className="text-sm text-muted">{children}</div>
        {footer && <div className="sticky -bottom-6 -mx-6 -mb-6 mt-6 flex flex-col-reverse gap-2 border-t border-line bg-surface px-6 pb-8 pt-4 sm:flex-row sm:justify-end sm:pb-6">{footer}</div>}
      </div>
    </div>
  );
}
