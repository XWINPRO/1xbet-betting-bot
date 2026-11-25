"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { signUpAction } from "@/lib/actions/auth";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/page";
import { SubmitButton } from "@/components/ui/client-helpers";
import { useI18n } from "@/i18n/client";

export function SignupForm({ next }: { next?: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(signUpAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  if (state?.ok && state.message === "confirm_email") {
    return (
      <div className="flex flex-col items-start gap-3">
        <span className="flex size-10 items-center justify-center rounded-md border border-line bg-subtle">
          <MailCheck className="size-5 text-ink-2" />
        </span>
        <h2 className="text-lg font-semibold">{t("Vérifiez votre boîte e-mail")}</h2>
        <p className="text-[13.5px] text-ink-3">
          {t("Un lien de confirmation a été envoyé à {email}. Ouvrez-le pour activer votre compte.", { email: state.data.email })}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state && !state.ok ? <Notice tone="danger">{t(state.error)}</Notice> : null}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label={t("Nom complet")} htmlFor="full_name" error={fe?.full_name}>
        <Input id="full_name" name="full_name" autoComplete="name" required aria-invalid={Boolean(fe?.full_name)} />
      </Field>
      <Field label={t("Téléphone")} htmlFor="phone" error={fe?.phone} hint={t("Format local accepté, ex. 6 90 12 34 56")}>
        <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required aria-invalid={Boolean(fe?.phone)} />
      </Field>
      <Field label={t("Adresse e-mail")} htmlFor="email" error={fe?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(fe?.email)} />
      </Field>
      <Field label={t("Mot de passe")} htmlFor="password" error={fe?.password} hint={t("8 caractères minimum")}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} aria-invalid={Boolean(fe?.password)} />
      </Field>
      <SubmitButton variant="primary" size="lg" block className="mt-2" pendingLabel={t("Création du compte…")}>
        {t("Créer mon compte")}
      </SubmitButton>
    </form>
  );
}
