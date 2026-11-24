"use client";

import { useActionState, useState } from "react";
import { Bike, MailCheck, Store } from "lucide-react";
import { signUpAction } from "@/lib/actions/auth";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/page";
import { SubmitButton } from "@/components/ui/client-helpers";
import { cn } from "@/lib/utils";

const INTENTS = [
  { value: "merchant", label: "J'ai une boutique", hint: "Commandes, produits, livreurs", icon: Store },
  { value: "courier", label: "Je suis livreur", hint: "Rejoindre le réseau", icon: Bike },
] as const;

export function SignupForm({ next, defaultIntent }: { next?: string; defaultIntent?: string }) {
  const [state, action] = useActionState(signUpAction, null);
  const [intent, setIntent] = useState(defaultIntent === "courier" ? "courier" : "merchant");
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  if (state?.ok && state.message === "confirm_email") {
    return (
      <div className="flex flex-col items-start gap-3">
        <span className="flex size-10 items-center justify-center rounded-md border border-line bg-subtle">
          <MailCheck className="size-5 text-ink-2" />
        </span>
        <h2 className="text-lg font-semibold">Vérifiez votre boîte e-mail</h2>
        <p className="text-[13.5px] text-ink-3">
          Un lien de confirmation a été envoyé à <span className="font-medium text-ink">{state.data.email}</span>. Ouvrez-le pour activer votre compte.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state && !state.ok ? <Notice tone="danger">{state.error}</Notice> : null}
      <input type="hidden" name="next" value={next ?? ""} />
      <input type="hidden" name="intent" value={intent} />
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-medium text-ink-2">Vous êtes</legend>
        <div className="grid grid-cols-2 gap-2">
          {INTENTS.map(({ value, label, hint, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setIntent(value)}
              aria-pressed={intent === value}
              className={cn(
                "flex flex-col items-start gap-1 rounded-md border px-3 py-2.5 text-left transition-colors",
                intent === value ? "border-accent bg-accent-soft/60 shadow-[inset_0_0_0_1px_var(--color-accent)]" : "border-line-strong hover:bg-subtle",
              )}
            >
              <Icon className={cn("size-4", intent === value ? "text-accent" : "text-ink-3")} />
              <span className="text-[13px] font-medium text-ink">{label}</span>
              <span className="text-xs text-ink-3">{hint}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <Field label="Nom complet" htmlFor="full_name" error={fe?.full_name}>
        <Input id="full_name" name="full_name" autoComplete="name" required aria-invalid={Boolean(fe?.full_name)} />
      </Field>
      <Field label="Téléphone" htmlFor="phone" error={fe?.phone} hint="Format local accepté, ex. 6 90 12 34 56">
        <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required aria-invalid={Boolean(fe?.phone)} />
      </Field>
      <Field label="Adresse e-mail" htmlFor="email" error={fe?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(fe?.email)} />
      </Field>
      <Field label="Mot de passe" htmlFor="password" error={fe?.password} hint="8 caractères minimum">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} aria-invalid={Boolean(fe?.password)} />
      </Field>
      <SubmitButton variant="primary" size="lg" block className="mt-2" pendingLabel="Création du compte…">
        Créer mon compte
      </SubmitButton>
    </form>
  );
}
