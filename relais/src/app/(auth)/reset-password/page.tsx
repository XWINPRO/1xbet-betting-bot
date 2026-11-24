"use client";

import { useActionState } from "react";
import { updatePasswordAction } from "@/lib/actions/auth";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/page";
import { SubmitButton } from "@/components/ui/client-helpers";

export default function ResetPasswordPage() {
  const [state, action] = useActionState(updatePasswordAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <>
      <h1 className="text-xl font-semibold tracking-[-0.01em]">Nouveau mot de passe</h1>
      <p className="mt-1 mb-7 text-[13.5px] text-ink-3">Choisissez un mot de passe d&apos;au moins 8 caractères.</p>
      <form action={action} className="flex flex-col gap-4">
        {state && !state.ok ? <Notice tone="danger">{state.error}</Notice> : null}
        <Field label="Nouveau mot de passe" htmlFor="password" error={fe?.password}>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <Field label="Confirmation" htmlFor="confirm" error={fe?.confirm}>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
        </Field>
        <SubmitButton variant="primary" size="lg" block>
          Enregistrer
        </SubmitButton>
      </form>
    </>
  );
}
