"use client";

import { CircleCheck, X } from "lucide-react";

export function Toast({ title, body, onClose }: { title: string; body?: string; onClose: () => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-sm animate-sheet items-start gap-3 rounded-xl bg-ink p-4 text-white shadow-lift sm:bottom-6"
    >
      <CircleCheck className="mt-0.5 size-5 shrink-0 text-gold" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {body && <p className="text-sm text-white/75">{body}</p>}
      </div>
      <button onClick={onClose} aria-label="Chiudi notifica" className="rounded p-0.5 text-white/70 hover:text-white">
        <X className="size-4" />
      </button>
    </div>
  );
}
