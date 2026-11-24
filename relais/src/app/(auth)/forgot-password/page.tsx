"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/lib/actions/auth";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/page";
import { SubmitButton } from "@/components/ui/client-helpers";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(requestPasswordResetAction, null);
  return (
    <>
      <h1 className="text-xl font-semibold tracking-[-0.01em]">Mot de passe oublié</h1>
      <p className="mt-1 mb-7 text-[13.5px] text-ink-3">Indiquez votre adresse e-mail : nous vous enverrons un lien de réinitialisation.</p>
      {state?.ok ? (
        <Notice tone="success">Si un compte existe pour cette adresse, un e-mail vient d&apos;être envoyé.</Notice>
      ) : (
        <form action={action} className="flex flex-col gap-4">
          {state && !state.ok ? <Notice tone="danger">{state.error}</Notice> : null}
          <Field label="Adresse e-mail" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </Field>
          <SubmitButton variant="primary" size="lg" block>
            Envoyer le lien
          </SubmitButton>
        </form>
      )}
      <p className="mt-6 text-[13px]">
        <Link href="/login" className="text-ink-3 hover:text-ink">
          ← Retour à la connexion
        </Link>
      </p>
    </>
  );
}
