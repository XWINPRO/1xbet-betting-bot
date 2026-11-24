"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateStoreOperationsAction } from "@/lib/actions/store";
import { Panel, PanelHeader, PanelFooter } from "@/components/ui/panel";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/input";
import { ToggleRow } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

export function OperationsSettings({ initial }: { initial: { courier_max_active_jobs: number; share_courier_phone: boolean } }) {
  const router = useRouter();
  const [v, setV] = React.useState(initial);
  const [pending, setPending] = React.useState(false);
  return (
    <Panel>
      <PanelHeader title="Règles de livraison" description="Ces règles déterminent la disponibilité réelle de vos livreurs." />
      <div className="flex flex-col gap-5 px-5 py-4">
        <Field
          label="Courses simultanées par livreur"
          htmlFor="max-jobs"
          hint="Au-delà, le livreur est affiché « en livraison » et n'est plus suggéré en priorité."
          className="sm:max-w-xs"
        >
          <NativeSelect id="max-jobs" value={v.courier_max_active_jobs} onChange={(e) => setV({ ...v, courier_max_active_jobs: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} course{n > 1 ? "s" : ""}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <ToggleRow
          id="share-phone"
          title="Afficher le numéro du livreur sur le lien de suivi"
          description="Le client peut appeler le livreur pendant la course. Le numéro disparaît une fois la livraison terminée."
          checked={v.share_courier_phone}
          onCheckedChange={(c) => setV({ ...v, share_courier_phone: c })}
        />
      </div>
      <PanelFooter>
        <Button
          variant="primary"
          loading={pending}
          onClick={async () => {
            setPending(true);
            const res = await updateStoreOperationsAction(v);
            setPending(false);
            if (!res.ok) return toast.error(res.error);
            toast.success("Règles enregistrées.");
            router.refresh();
          }}
        >
          Enregistrer
        </Button>
      </PanelFooter>
    </Panel>
  );
}
