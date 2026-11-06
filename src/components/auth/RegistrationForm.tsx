"use client";

import { ArrowRight, AtSign, LoaderCircle, Lock } from "lucide-react";
import { APP } from "@/lib/config";
import { useActionState } from "react";
import { completeRegistration, type RegistrationState } from "@/app/registrazione/actions";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";

export function RegistrationForm({ email, firstName, lastName }: { email: string; firstName: string; lastName: string }) {
  const [state, action, pending] = useActionState<RegistrationState, FormData>(completeRegistration, {
    values: { firstName, lastName, classYear: "", classSection: "" },
  });
  const v = state.values ?? { firstName, lastName, classYear: "", classSection: "" };
  const fe = state.fieldErrors ?? {};
  const err = (id: string, msg?: string) => msg && <p id={id} className="text-xs font-medium text-danger">{msg}</p>;

  return (
    <form action={action} className="mt-7 space-y-4" noValidate>
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <Field label="Email della scuola" htmlFor="reg-email" hint="Recuperata dal tuo account Google: non è modificabile.">
        <div className="relative">
          <TextInput id="reg-email" value={email} readOnly aria-readonly icon={<AtSign />} className="bg-paper pr-9 text-muted" />
          <Lock className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        </div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" htmlFor="reg-first">
          <TextInput id="reg-first" name="firstName" defaultValue={v.firstName} autoComplete="given-name" required maxLength={60} aria-invalid={Boolean(fe.firstName)} aria-describedby={fe.firstName ? "reg-first-err" : undefined} />
          {err("reg-first-err", fe.firstName)}
        </Field>
        <Field label="Cognome" htmlFor="reg-last">
          <TextInput id="reg-last" name="lastName" defaultValue={v.lastName} autoComplete="family-name" required maxLength={60} aria-invalid={Boolean(fe.lastName)} aria-describedby={fe.lastName ? "reg-last-err" : undefined} />
          {err("reg-last-err", fe.lastName)}
        </Field>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold text-ink">Classe</legend>
        <div className="grid grid-cols-[1fr_1fr] gap-3">
          <div>
            <label htmlFor="reg-year" className="sr-only">Anno</label>
            <Select id="reg-year" name="classYear" defaultValue={v.classYear} required aria-invalid={Boolean(fe.classYear)}>
              <option value="" disabled>Anno</option>
              {[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>{y}ª</option>)}
            </Select>
            {err("reg-year-err", fe.classYear)}
          </div>
          <div>
            <label htmlFor="reg-section" className="sr-only">Sezione</label>
            <TextInput id="reg-section" name="classSection" defaultValue={v.classSection} placeholder="Sezione, es. B" maxLength={3} required className="uppercase" aria-invalid={Boolean(fe.classSection)} />
            {err("reg-section-err", fe.classSection)}
          </div>
        </div>
      </fieldset>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" /> : null}
        {pending ? "Salvataggio…" : <>Completa la registrazione <ArrowRight /></>}
      </Button>
      <p className="text-center text-xs text-muted">
        Proseguendo confermi di aver letto l&apos;
        <a href={APP.privacyUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink-soft underline underline-offset-2">informativa privacy</a>.
        Salviamo solo nome, cognome, classe ed email della scuola.
      </p>
    </form>
  );
}
