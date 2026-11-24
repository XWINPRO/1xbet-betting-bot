"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInAction } from "@/lib/actions/auth";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/page";
import { SubmitButton } from "@/components/ui/client-helpers";

export function LoginForm({ next, linkError }: { next?: string; linkError?: boolean }) {
  const [state, action] = useActionState(signInAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {linkError ? <Notice tone="warning">Ce lien est invalide ou a expiré. Connectez-vous ou demandez un nouveau lien.</Notice> : null}
      {state && !state.ok ? <Notice tone="danger">{state.error}</Notice> : null}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Adresse e-mail" htmlFor="email" error={fe?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(fe?.email)} />
      </Field>
      <Field
        label={
          <span className="flex items-center justify-between">
            Mot de passe
            <Link href="/forgot-password" className="text-xs font-normal text-ink-3 hover:text-ink">
              Mot de passe oublié ?
            </Link>
          </span>
        }
        htmlFor="password"
        error={fe?.password}
      >
        <Input id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={Boolean(fe?.password)} />
      </Field>
      <SubmitButton variant="primary" size="lg" block className="mt-2" pendingLabel="Connexion…">
        Se connecter
      </SubmitButton>
    </form>
  );
}
