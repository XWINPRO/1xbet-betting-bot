"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateCourierProfileAction } from "@/lib/actions/courier";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { VEHICLES } from "@/lib/status";

export function CourierProfileForm({ initial, canResubmit }: { initial: { phone: string; vehicle_type: string; vehicle_plate: string; zone: string }; canResubmit: boolean }) {
  const router = useRouter();
  const [v, setV] = React.useState(initial);
  const [pending, setPending] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const res = await updateCourierProfileAction({ ...v, resubmit: canResubmit });
        setPending(false);
        if (!res.ok) {
          setErrors(res.fieldErrors ?? {});
          return toast.error(res.error);
        }
        toast.success(canResubmit ? "Profil soumis à nouveau." : "Profil mis à jour.");
        router.refresh();
      }}
    >
      <Field label="Téléphone" htmlFor="cp-phone" error={errors.phone}>
        <Input id="cp-phone" type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} className="h-11 text-base" />
      </Field>
      <Field label="Moyen de transport" htmlFor="cp-vehicle">
        <NativeSelect id="cp-vehicle" value={v.vehicle_type} onChange={(e) => setV({ ...v, vehicle_type: e.target.value })} className="h-11 text-base">
          {Object.entries(VEHICLES).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Immatriculation" htmlFor="cp-plate" optional>
        <Input id="cp-plate" value={v.vehicle_plate} onChange={(e) => setV({ ...v, vehicle_plate: e.target.value })} className="h-11 text-base" />
      </Field>
      <Field label="Zone de travail" htmlFor="cp-zone" optional>
        <Input id="cp-zone" value={v.zone} onChange={(e) => setV({ ...v, zone: e.target.value })} className="h-11 text-base" />
      </Field>
      <Button type="submit" size="lg" variant="primary" loading={pending}>
        {canResubmit ? "Soumettre à nouveau" : "Enregistrer"}
      </Button>
    </form>
  );
}
