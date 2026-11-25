"use client";

import { useI18n } from "@/i18n/client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, UserPlus } from "lucide-react";
import { addCourierAction, updateCourierAction } from "@/lib/actions/couriers";
import { LocationPicker } from "@/components/map/location-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, InputGroup, NativeSelect, Textarea } from "@/components/ui/input";
import { CopyButton } from "@/components/ui/client-helpers";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { Notice } from "@/components/ui/page";
import { VEHICLES } from "@/lib/status";
import { whatsappUrl, waMessages } from "@/lib/whatsapp";

export type CourierFormValue = {
  full_name: string;
  phone: string;
  vehicle_type: string;
  vehicle_plate: string;
  zone: string;
  zone_lat: number | null;
  zone_lng: number | null;
  zone_radius_km: string;
  notes: string;
};

const EMPTY: CourierFormValue = { full_name: "", phone: "", vehicle_type: "moto", vehicle_plate: "", zone: "", zone_lat: null, zone_lng: null, zone_radius_km: "", notes: "" };

export function CourierFormDialog({
  mode,
  courierId,
  initial,
  storeName,
  defaultOpen,
}: {
  mode: "create" | "edit";
  courierId?: string;
  initial?: CourierFormValue;
  storeName: string;
  defaultOpen?: boolean;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const router = useRouter();
  const [open, setOpen] = React.useState(Boolean(defaultOpen));
  const [v, setV] = React.useState<CourierFormValue>(initial ?? EMPTY);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);
  const [invite, setInvite] = React.useState<{ url: string; phone: string } | null>(null);

  async function submit() {
    setPending(true);
    const payload = { ...v, zone_radius_km: v.zone_radius_km };
    const res = mode === "create" ? await addCourierAction(payload) : await updateCourierAction(courierId!, payload);
    setPending(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(t(res.error));
      return;
    }
    router.refresh();
    if (mode === "create" && res.data && "inviteUrl" in res.data) {
      setInvite({ url: res.data.inviteUrl, phone: v.phone });
    } else {
      toast.success(t("Livreur mis à jour."));
      setOpen(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setV(initial ?? EMPTY);
          setErrors({});
          setInvite(null);
        }
      }}
    >
      {mode === "create" ? (
        <Button variant="primary" onClick={() => setOpen(true)}>
          <UserPlus /> {t("Ajouter un livreur")}
        </Button>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <Pencil /> {t("Modifier")}
        </Button>
      )}
      <DialogContent
        size="lg"
        title={invite ? t("Livreur ajouté") : mode === "create" ? t("Ajouter un livreur") : t("Modifier le livreur")}
        description={invite ? undefined : t("Le livreur active son accès depuis son téléphone grâce au lien d'invitation.")}
        footer={
          invite ? (
            <Button variant="primary" onClick={() => setOpen(false)}>
              {t("Terminé")}
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                {t("Annuler")}
              </Button>
              <Button variant="primary" loading={pending} onClick={submit}>
                {mode === "create" ? t("Ajouter et générer l'invitation") : t("Enregistrer")}
              </Button>
            </>
          )
        }
      >
        {invite ? (
          <div className="flex flex-col gap-4">
            <Notice tone="success" title={t("Invitation créée (valable 7 jours)")}>
              {t("Envoyez ce lien au livreur. Il crée son compte (ou se connecte) puis son accès est activé automatiquement.")}
            </Notice>
            <div className="rounded-md border border-line bg-subtle p-3">
              <p className="truncate font-mono text-xs text-ink-2">{invite.url}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <CopyButton value={invite.url} label={t("Copier le lien")} />
                <WhatsAppButton size="sm" label={t("Envoyer par WhatsApp")} href={whatsappUrl(invite.phone, waMessages(i18n).courierInvite({ storeName, url: invite.url }))} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("Nom complet")} htmlFor="co-name" error={errors.full_name}>
                <Input id="co-name" value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} />
              </Field>
              <Field label={t("Téléphone (WhatsApp)")} htmlFor="co-phone" error={errors.phone}>
                <Input id="co-phone" type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
              </Field>
              <Field label={t("Moyen de transport")} htmlFor="co-vehicle">
                <NativeSelect id="co-vehicle" value={v.vehicle_type} onChange={(e) => setV({ ...v, vehicle_type: e.target.value })}>
                  {Object.entries(VEHICLES).map(([k, label]) => (
                    <option key={k} value={k}>
                      {t(label)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label={t("Immatriculation")} htmlFor="co-plate" optional>
                <Input id="co-plate" value={v.vehicle_plate} onChange={(e) => setV({ ...v, vehicle_plate: e.target.value })} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
              <Field label={t("Zone de travail")} htmlFor="co-zone" optional hint={t("Quartiers ou secteur couverts.")}>
                <Input id="co-zone" value={v.zone} onChange={(e) => setV({ ...v, zone: e.target.value })} placeholder={t("Ex. Akwa, Bonapriso, Deido")} />
              </Field>
              <Field label={t("Rayon")} htmlFor="co-radius" optional error={errors.zone_radius_km}>
                <InputGroup id="co-radius" type="number" min={1} max={100} suffix="km" value={v.zone_radius_km} onChange={(e) => setV({ ...v, zone_radius_km: e.target.value })} />
              </Field>
            </div>
            <Field label={t("Centre de la zone")} optional hint={t("Utilisé par la suggestion de livreur (collecte dans la zone ou non).")}>
              <LocationPicker
                value={v.zone_lat != null && v.zone_lng != null ? { lat: v.zone_lat, lng: v.zone_lng } : null}
                onChange={(p) => setV({ ...v, zone_lat: p?.lat ?? null, zone_lng: p?.lng ?? null })}
                height={180}
              />
            </Field>
            <Field label={t("Notes internes")} htmlFor="co-notes" optional>
              <Textarea id="co-notes" rows={2} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
            </Field>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
