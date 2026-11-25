"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { deletePricingRuleAction, savePricingRuleAction } from "@/lib/actions/admin";
import { Panel, PanelHeader, PanelFooter } from "@/components/ui/panel";
import { Field } from "@/components/ui/field";
import { Input, InputGroup } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ToggleRow } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PACKAGE_TYPES } from "@/lib/status";
import { formatMoney } from "@/lib/format";

export type RuleValue = {
  id: string | null;
  name: string;
  base_fee: number;
  per_km_fee: number;
  min_fee: number;
  max_distance_km: number | null;
  rounding: number;
  surcharges: Record<string, number>;
  is_active: boolean;
};

function example(r: RuleValue, km: number) {
  const raw = Math.max(r.min_fee, r.base_fee + r.per_km_fee * km);
  return Math.ceil(raw / Math.max(1, r.rounding)) * Math.max(1, r.rounding);
}

export function PricingEditor({ rule }: { rule: RuleValue }) {
  const router = useRouter();
  const [v, setV] = React.useState(rule);
  const [pending, setPending] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const num = (s: string) => (s === "" ? 0 : Number(s));

  return (
    <Panel>
      <PanelHeader
        title={rule.id ? rule.name : "Nouvelle grille"}
        actions={rule.is_active ? <Badge tone="success">Active</Badge> : rule.id ? <Badge tone="neutral">Inactive</Badge> : null}
      />
      <div className="flex flex-col gap-4 px-5 py-4">
        <Field label="Nom" htmlFor={`n-${rule.id}`} error={errors.name}>
          <Input id={`n-${rule.id}`} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Prise en charge" htmlFor={`b-${rule.id}`}>
            <InputGroup id={`b-${rule.id}`} type="number" min={0} suffix="FCFA" value={v.base_fee} onChange={(e) => setV({ ...v, base_fee: num(e.target.value) })} />
          </Field>
          <Field label="Prix par km" htmlFor={`k-${rule.id}`}>
            <InputGroup id={`k-${rule.id}`} type="number" min={0} suffix="FCFA" value={v.per_km_fee} onChange={(e) => setV({ ...v, per_km_fee: num(e.target.value) })} />
          </Field>
          <Field label="Minimum" htmlFor={`m-${rule.id}`}>
            <InputGroup id={`m-${rule.id}`} type="number" min={0} suffix="FCFA" value={v.min_fee} onChange={(e) => setV({ ...v, min_fee: num(e.target.value) })} />
          </Field>
          <Field label="Distance maximale" htmlFor={`d-${rule.id}`} optional>
            <InputGroup id={`d-${rule.id}`} type="number" min={1} suffix="km" value={v.max_distance_km ?? ""} onChange={(e) => setV({ ...v, max_distance_km: e.target.value === "" ? null : Number(e.target.value) })} />
          </Field>
          <Field label="Arrondi" htmlFor={`r-${rule.id}`}>
            <InputGroup id={`r-${rule.id}`} type="number" min={1} suffix="FCFA" value={v.rounding} onChange={(e) => setV({ ...v, rounding: Math.max(1, num(e.target.value)) })} />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-ink-2">Suppléments par type de colis</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {Object.entries(PACKAGE_TYPES).map(([k, label]) => (
              <Field key={k} label={label} htmlFor={`s-${rule.id}-${k}`}>
                <InputGroup id={`s-${rule.id}-${k}`} type="number" min={0} suffix="FCFA" value={v.surcharges[k] ?? 0} onChange={(e) => setV({ ...v, surcharges: { ...v.surcharges, [k]: num(e.target.value) } })} />
              </Field>
            ))}
          </div>
        </fieldset>
        <ToggleRow id={`a-${rule.id}`} title="Grille active" description="Une seule grille est utilisée à la fois pour calculer les prix." checked={v.is_active} onCheckedChange={(c) => setV({ ...v, is_active: c })} />
        <p className="text-xs text-ink-3">
          Exemples (petit colis) : 2 km → {formatMoney(example(v, 2), "XAF")} · 5 km → {formatMoney(example(v, 5), "XAF")} · 10 km → {formatMoney(example(v, 10), "XAF")}. Distance calculée à vol d&apos;oiseau.
        </p>
      </div>
      <PanelFooter className="justify-between">
        {rule.id && !rule.is_active ? (
          <Button
            variant="danger-ghost"
            size="sm"
            onClick={async () => {
              const res = await deletePricingRuleAction(rule.id!);
              if (!res.ok) return toast.error(res.error);
              router.refresh();
            }}
          >
            <Trash2 /> Supprimer
          </Button>
        ) : (
          <span />
        )}
        <Button
          variant="primary"
          loading={pending}
          onClick={async () => {
            setPending(true);
            const { id, ...payload } = v;
            const res = await savePricingRuleAction(id, payload);
            setPending(false);
            if (!res.ok) {
              setErrors(res.fieldErrors ?? {});
              return toast.error(res.error);
            }
            toast.success("Tarification enregistrée.");
            router.refresh();
          }}
        >
          {rule.id ? "Enregistrer" : <><Plus /> Créer la grille</>}
        </Button>
      </PanelFooter>
    </Panel>
  );
}
