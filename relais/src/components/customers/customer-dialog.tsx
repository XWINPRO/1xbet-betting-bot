"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { saveCustomerAction } from "@/lib/actions/customers";
import { LocationPicker } from "@/components/map/location-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import type { LatLng } from "@/lib/geo";

export type CustomerValue = {
  id?: string;
  full_name: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  lat: number | null;
  lng: number | null;
  notes: string;
};

export function CustomerDialog({ initial, mode }: { initial?: CustomerValue; mode: "create" | "edit" }) {
  const router = useRouter();
  const empty: CustomerValue = { full_name: "", phone: "", whatsapp: "", email: "", address: "", lat: null, lng: null, notes: "" };
  const [open, setOpen] = React.useState(false);
  const [v, setV] = React.useState<CustomerValue>(initial ?? empty);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);
  const point: LatLng | null = v.lat != null && v.lng != null ? { lat: v.lat, lng: v.lng } : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setV(initial ?? empty);
          setErrors({});
        }
      }}
    >
      {mode === "create" ? (
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus /> Ajouter un client
        </Button>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <Pencil /> Modifier
        </Button>
      )}
      <DialogContent
        size="lg"
        title={mode === "create" ? "Nouveau client" : "Modifier le client"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              loading={pending}
              onClick={async () => {
                setPending(true);
                const res = await saveCustomerAction(initial?.id ?? null, v);
                setPending(false);
                if (!res.ok) {
                  setErrors(res.fieldErrors ?? {});
                  toast.error(res.error);
                  return;
                }
                toast.success("Client enregistré.");
                setOpen(false);
                if (mode === "create") router.push(`/dashboard/customers/${res.data.id}`);
                router.refresh();
              }}
            >
              Enregistrer
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom" htmlFor="cu-name" error={errors.full_name}>
              <Input id="cu-name" value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} />
            </Field>
            <Field label="Téléphone" htmlFor="cu-phone" error={errors.phone}>
              <Input id="cu-phone" type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
            </Field>
            <Field label="WhatsApp" htmlFor="cu-wa" optional error={errors.whatsapp} hint="Si différent du téléphone.">
              <Input id="cu-wa" type="tel" value={v.whatsapp} onChange={(e) => setV({ ...v, whatsapp: e.target.value })} />
            </Field>
            <Field label="E-mail" htmlFor="cu-email" optional error={errors.email}>
              <Input id="cu-email" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
            </Field>
          </div>
          <Field label="Adresse habituelle" htmlFor="cu-address" optional>
            <Input id="cu-address" value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} />
          </Field>
          <LocationPicker value={point} onChange={(p) => setV({ ...v, lat: p?.lat ?? null, lng: p?.lng ?? null })} kind="dropoff" height={200} />
          <Field label="Notes" htmlFor="cu-notes" optional>
            <Textarea id="cu-notes" rows={2} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
          </Field>
        </div>
      </DialogContent>
    </Dialog>
  );
}
