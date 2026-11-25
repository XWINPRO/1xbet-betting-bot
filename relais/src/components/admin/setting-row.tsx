"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateSettingAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export function SettingRow({ settingKey, label, description, value, unit }: { settingKey: string; label: string; description: string | null; value: number | boolean; unit?: string }) {
  const router = useRouter();
  const [v, setV] = React.useState(value);
  const [pending, setPending] = React.useState(false);
  const dirty = v !== value;
  async function save(next: number | boolean) {
    setPending(true);
    const res = await updateSettingAction(settingKey, next);
    setPending(false);
    if (!res.ok) {
      setV(value);
      return toast.error(res.error);
    }
    toast.success("Paramètre enregistré.");
    router.refresh();
  }
  return (
    <div className="flex flex-wrap items-center gap-4 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium">{label}</p>
        {description ? <p className="text-xs text-ink-3">{description}</p> : null}
        <p className="font-mono text-[11px] text-ink-4">{settingKey}</p>
      </div>
      {typeof value === "boolean" ? (
        <Switch
          checked={v as boolean}
          disabled={pending}
          onCheckedChange={(c) => {
            setV(c);
            void save(c);
          }}
        />
      ) : (
        <div className="flex items-center gap-2">
          <div className="relative">
            <Input type="number" min={0} value={v as number} onChange={(e) => setV(Number(e.target.value))} className="w-28 pr-9 text-right" aria-label={label} />
            {unit ? <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-ink-4">{unit}</span> : null}
          </div>
          <Button size="sm" variant={dirty ? "primary" : "secondary"} disabled={!dirty} loading={pending} onClick={() => save(v)}>
            Enregistrer
          </Button>
        </div>
      )}
    </div>
  );
}
