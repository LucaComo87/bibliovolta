"use client";

import { ScrollText, Search } from "lucide-react";
import { useState } from "react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select, TextInput } from "@/components/ui/Field";
import { PageHeading } from "@/components/ui/PageHeading";
import { ACTIVITY_CATEGORIES, type ActivityCategory, describeActivity } from "@/lib/teacher/activity";
import type { ActivityEntry } from "@/lib/teacher/types";

const TZ = "Europe/Rome";
const dayHead = (iso: string) => new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(new Date(iso));
const hour = (iso: string) => new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso));
const toneBadge: Record<string, BadgeTone> = { neutral: "neutral", gold: "gold", danger: "danger", success: "success" };

/** Registro delle operazioni dei docenti, con filtro per tipo e ricerca. */
export function TeacherActivityView({ entries }: { entries: ActivityEntry[] }) {
  const [category, setCategory] = useState<"" | ActivityCategory>("");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const rows = entries
    .map((e) => ({ e, d: describeActivity(e) }))
    .filter(({ e, d }) => (!category || d.category === category) && (!q || `${d.title} ${d.detail ?? ""} ${e.actor}`.toLowerCase().includes(q)));
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = dayHead(r.e.at);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }

  return (
    <>
      <PageHeading eyebrow="Registro delle operazioni" title="Chi ha fatto cosa">
        Aperture e chiusure, cambi di orario, annullamenti manuali, comunicazioni e impostazioni: ogni operazione dei docenti resta registrata.
      </PageHeading>
      <div className="mb-5 grid gap-2 sm:grid-cols-[1fr_16rem]">
        <div>
          <label htmlFor="log-search" className="sr-only">Cerca nel registro</label>
          <TextInput id="log-search" icon={<Search />} placeholder="Cerca per studente, giornata, docente…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div>
          <label htmlFor="log-category" className="sr-only">Tipo di operazione</label>
          <Select id="log-category" value={category} onChange={(e) => setCategory(e.target.value as "" | ActivityCategory)}>
            <option value="">Tutte le operazioni</option>
            {Object.entries(ACTIVITY_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </div>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={<ScrollText />} title={entries.length ? "Nessuna operazione trovata" : "Registro vuoto"}>
          {entries.length ? "Cambia i filtri di ricerca." : "Le operazioni dei docenti compariranno qui."}
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {[...groups].map(([head, items]) => (
            <section key={head}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-wood first-letter:uppercase">{head}</h2>
              <Card className="p-0 sm:p-0">
                <ul className="divide-y divide-line">
                  {items.map(({ e, d }) => (
                    <li key={e.id} className="grid gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[3.5rem_1fr_auto] sm:px-5" data-testid="log-entry">
                      <span className="text-xs font-semibold text-muted tabular sm:pt-0.5">{hour(e.at)}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink first-letter:uppercase">{d.title}</p>
                        {d.detail && <p className="text-xs text-muted first-letter:uppercase">{d.detail}</p>}
                        <p className="mt-0.5 text-xs text-muted">{e.actor}</p>
                      </div>
                      <div className="sm:pt-0.5"><Badge tone={toneBadge[d.tone]}>{ACTIVITY_CATEGORIES[d.category]}</Badge></div>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
