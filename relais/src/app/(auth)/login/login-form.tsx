"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInAction } from "@/lib/actions/auth";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/page";
import { SubmitButton } from "@/components/ui/client-helpers";
import { useI18n } from "@/i18n/client";

export function LoginForm({ next, linkError }: { next?: string; linkError?: boolean }) {
  const { t } = useI18n();
  const [state, action] = useActionState(signInAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {linkError ? <Notice tone="warning">{t("Ce lien est invalide ou a expiré. Connectez-vous ou demandez un nouveau lien.")}</Notice> : null}
      {state && !state.ok ? <Notice tone="danger">{t(state.error)}</Notice> : null}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label={t("Adresse e-mail")} htmlFor="email" error={fe?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(fe?.email)} />
      </Field>
      <Field
        label={
          <span className="flex items-center justify-between">
            {t("Mot de passe")}
            <Link href="/forgot-password" className="text-xs font-normal text-ink-3 hover:text-ink">
              {t("Mot de passe oublié ?")}
            </Link>
          </span>
        }
        htmlFor="password"
        error={fe?.password}
      >
        <Input id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={Boolean(fe?.password)} />
      </Field>
      <SubmitButton variant="primary" size="lg" block className="mt-2" pendingLabel={t("Connexion…")}>
        {t("Se connecter")}
      </SubmitButton>
    </form>
  );
}
