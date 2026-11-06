"use client";

import { Clock3, LoaderCircle, Save } from "lucide-react";
import { useActionState } from "react";
import { setOpeningHours, type HoursState } from "@/app/docenti/(area)/actions";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Field, TextInput } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";

export function OpeningHoursForm({ opensAt, closesAt, cancellationHours }: { opensAt: string; closesAt: string; cancellationHours: number }) {
  const [state, action, pending] = useActionState<HoursState, FormData>(setOpeningHours, {});
  return (
    <Card>
      <CardTitle icon={<Clock3 />} eyebrow="Impostazioni">Orario dell&apos;aula studio</CardTitle>
      <form action={action} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Apertura" htmlFor="hours-open">
            <TextInput id="hours-open" name="opensAt" type="time" defaultValue={opensAt} required step={300} />
          </Field>
          <Field label="Chiusura" htmlFor="hours-close">
            <TextInput id="hours-close" name="closesAt" type="time" defaultValue={closesAt} required step={300} />
          </Field>
        </div>
        <p className="text-xs text-muted">
          Vale per tutte le giornate da domani in poi. Gli studenti possono annullare fino a {cancellationHours} ore prima dell&apos;apertura.
        </p>
        {state.error && <Notice tone="danger">{state.error}</Notice>}
        {state.ok && <Notice title="Orario aggiornato">Modificate {state.updated} giornate future.</Notice>}
        <Button type="submit" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" /> : <Save />} Salva orario
        </Button>
      </form>
    </Card>
  );
}
