"use client";

import { KeyRound, LoaderCircle, Mail } from "lucide-react";
import { useActionState } from "react";
import { teacherSignIn, type TeacherLoginState } from "@/app/accesso/docenti/actions";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";

export function TeacherLoginForm() {
  const [state, action, pending] = useActionState<TeacherLoginState, FormData>(teacherSignIn, {});
  return (
    <form action={action} className="mt-8 space-y-4" noValidate>
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <Field label="Email istituzionale" htmlFor="teacher-email">
        <TextInput
          id="teacher-email"
          name="email"
          type="email"
          required
          autoComplete="username"
          defaultValue={state.email}
          placeholder="nome.cognome@liceovoltacomo.edu.it"
          icon={<Mail />}
        />
      </Field>
      <Field label="Password" htmlFor="teacher-password">
        <TextInput id="teacher-password" name="password" type="password" required autoComplete="current-password" placeholder="••••••••" icon={<KeyRound />} />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" /> : null}
        {pending ? "Accesso in corso…" : "Accedi all'area docenti"}
      </Button>
      <p className="text-center text-xs text-muted">
        Password dimenticata? Chiedi all&apos;amministratore della piattaforma di reimpostarla.
      </p>
    </form>
  );
}
