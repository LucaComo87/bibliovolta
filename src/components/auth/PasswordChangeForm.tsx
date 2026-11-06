"use client";

import { CircleCheck, KeyRound, LoaderCircle, LockKeyhole } from "lucide-react";
import { useActionState } from "react";
import { changeTeacherPassword, type PasswordChangeState } from "@/app/docenti/password/actions";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-policy";
import { ROUTES } from "@/lib/config";

export function PasswordChangeForm({ forced }: { forced: boolean }) {
  const [state, action, pending] = useActionState<PasswordChangeState, FormData>(changeTeacherPassword, {});

  if (state.done) {
    return (
      <div className="mt-6 space-y-5">
        <Notice title="Password aggiornata">La nuova password è attiva da subito. Usala al prossimo accesso.</Notice>
        <ButtonLink href={ROUTES.teacher} size="lg" className="w-full">
          <CircleCheck /> Vai alla dashboard
        </ButtonLink>
      </div>
    );
  }

  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="mt-6 space-y-4" noValidate>
      {forced && (
        <Notice tone="warning" title="Primo accesso">
          Stai usando la password iniziale comune a tutti i docenti: scegline una personale per continuare.
        </Notice>
      )}
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <Field label="Password attuale" htmlFor="pw-current">
        <TextInput id="pw-current" name="current" type="password" autoComplete="current-password" required icon={<KeyRound />} aria-invalid={Boolean(fe.current)} aria-describedby={fe.current ? "pw-current-err" : undefined} />
        {fe.current && <p id="pw-current-err" className="text-xs font-medium text-danger">{fe.current}</p>}
      </Field>
      <Field label="Nuova password" htmlFor="pw-next" hint={`Almeno ${PASSWORD_MIN_LENGTH} caratteri, con lettere e numeri.`}>
        <TextInput id="pw-next" name="next" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN_LENGTH} icon={<LockKeyhole />} aria-invalid={Boolean(fe.next)} aria-describedby={fe.next ? "pw-next-err" : undefined} />
        {fe.next && <p id="pw-next-err" className="text-xs font-medium text-danger">{fe.next}</p>}
      </Field>
      <Field label="Ripeti la nuova password" htmlFor="pw-confirm">
        <TextInput id="pw-confirm" name="confirm" type="password" autoComplete="new-password" required icon={<LockKeyhole />} aria-invalid={Boolean(fe.confirm)} aria-describedby={fe.confirm ? "pw-confirm-err" : undefined} />
        {fe.confirm && <p id="pw-confirm-err" className="text-xs font-medium text-danger">{fe.confirm}</p>}
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <LoaderCircle className="animate-spin" />}
        {pending ? "Aggiornamento…" : "Salva la nuova password"}
      </Button>
    </form>
  );
}
