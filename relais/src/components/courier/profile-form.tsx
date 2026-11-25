"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateCourierProfileAction } from "@/lib/actions/courier";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { VEHICLES } from "@/lib/status";
import { useI18n } from "@/i18n/client";

export function CourierProfileForm({ initial }: { initial: { phone: string; vehicle_type: string; vehicle_plate: string; zone: string } }) {
  const { t } = useI18n();
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
        const res = await updateCourierProfileAction(v);
        setPending(false);
        if (!res.ok) {
          setErrors(res.fieldErrors ?? {});
          return toast.error(t(res.error));
        }
        toast.success(t("Profil mis à jour."));
        router.refresh();
      }}
    >
      <Field label={t("Téléphone")} htmlFor="cp-phone" error={errors.phone}>
        <Input id="cp-phone" type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} className="h-11 text-base" />
      </Field>
      <Field label={t("Moyen de transport")} htmlFor="cp-vehicle">
        <NativeSelect id="cp-vehicle" value={v.vehicle_type} onChange={(e) => setV({ ...v, vehicle_type: e.target.value })} className="h-11 text-base">
          {Object.entries(VEHICLES).map(([k, label]) => (
            <option key={k} value={k}>
              {t(label)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label={t("Immatriculation")} htmlFor="cp-plate" optional>
        <Input id="cp-plate" value={v.vehicle_plate} onChange={(e) => setV({ ...v, vehicle_plate: e.target.value })} className="h-11 text-base" />
      </Field>
      <Field label={t("Zone de travail")} htmlFor="cp-zone" optional>
        <Input id="cp-zone" value={v.zone} onChange={(e) => setV({ ...v, zone: e.target.value })} className="h-11 text-base" />
      </Field>
      <Button type="submit" size="lg" variant="primary" loading={pending}>
        {t("Enregistrer")}
      </Button>
    </form>
  );
}
