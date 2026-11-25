"use client";

import * as React from "react";
import { Check, Minus } from "lucide-react";
import { useI18n } from "@/i18n/client";
import type { I18n } from "@/i18n/translate";
import { PLAN_META, TRACKING_LEVEL } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { Plan } from "@/types/domain";

type PlanLike = Pick<Plan, "code" | "price_monthly" | "currency" | "max_couriers" | "max_staff" | "tracking">;

/** Contenu réel d'un plan, déduit de ses limites (rien d'inventé). */
export function planFeatures(plan: PlanLike, { t, tn }: Pick<I18n, "t" | "tn">): { text: string; included: boolean }[] {
  return [
    { text: t("Boutique en ligne, commandes WhatsApp et clients"), included: true },
    {
      text: plan.max_couriers === 0 ? t("Aucun livreur") : tn(plan.max_couriers, "{n} livreur à parrainer", "{n} livreurs à parrainer"),
      included: plan.max_couriers > 0,
    },
    { text: t(TRACKING_LEVEL[plan.tracking]), included: plan.tracking !== "none" },
    { text: t("Lien de suivi à envoyer au client"), included: plan.tracking !== "none" },
    { text: t("Carte des livreurs et des livraisons en cours"), included: plan.tracking === "live" },
    {
      text: plan.max_staff === 0 ? t("Pas de compte employé") : tn(plan.max_staff, "{n} employé avec permissions", "{n} employés avec permissions"),
      included: plan.max_staff > 0,
    },
  ];
}

export function PlanPrice({ plan, className }: { plan: PlanLike; className?: string }) {
  const { t, f } = useI18n();
  const price = Number(plan.price_monthly);
  return (
    <p className={cn("flex items-baseline gap-1", className)}>
      <span className="text-[26px] font-semibold tracking-[-0.02em] tabular">{price === 0 ? t("Gratuit") : f.money(price, plan.currency)}</span>
      {price > 0 ? <span className="text-[13px] text-ink-3">{t("/ mois")}</span> : null}
    </p>
  );
}

export function PlanCard({
  plan,
  current = false,
  highlight = false,
  action,
  footnote,
}: {
  plan: PlanLike;
  current?: boolean;
  highlight?: boolean;
  action?: React.ReactNode;
  footnote?: React.ReactNode;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const meta = PLAN_META[plan.code] ?? { name: plan.code, tagline: "" };
  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border bg-surface p-5 shadow-xs",
        highlight ? "border-ink shadow-[inset_0_0_0_1px_var(--color-ink)]" : "border-line",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold">{t(meta.name)}</h3>
        {current ? (
          <span className="rounded-xs bg-success-soft px-1.5 py-0.5 text-[11px] font-medium text-success-ink">{t("Plan actuel")}</span>
        ) : null}
      </div>
      <p className="mt-1 min-h-[38px] text-[13px] leading-snug text-ink-3">{meta.tagline ? t(meta.tagline) : null}</p>
      <PlanPrice plan={plan} className="mt-3" />
      <ul className="mt-4 flex-1 space-y-2 text-[13px]">
        {planFeatures(plan, i18n).map((feature) => (
          <li key={feature.text} className={cn("flex gap-2", feature.included ? "text-ink-2" : "text-ink-4")}>
            {feature.included ? <Check className="mt-0.5 size-3.5 shrink-0 text-success" /> : <Minus className="mt-0.5 size-3.5 shrink-0" />}
            <span>{feature.text}</span>
          </li>
        ))}
      </ul>
      {action ? <div className="mt-5">{action}</div> : null}
      {footnote ? <div className="mt-2 text-xs text-ink-3">{footnote}</div> : null}
    </div>
  );
}
