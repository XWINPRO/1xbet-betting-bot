"use client";

import { useI18n } from "@/i18n/client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { setOrderItemsAction, updateOrderDetailsAction } from "@/lib/actions/orders";
import { ItemEditor, newKey, type CatalogProduct, type ItemLine } from "@/components/orders/item-editor";
import { LocationPicker } from "@/components/map/location-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, InputGroup, NativeSelect, Textarea } from "@/components/ui/input";
import { PAYMENT_METHOD } from "@/lib/status";
import type { LatLng } from "@/lib/geo";
import type { PaymentMethod } from "@/types/domain";

export type EditableOrder = {
  id: string;
  customer_name: string;
  customer_phone: string;
  delivery_mode: "delivery" | "pickup";
  delivery_address: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_fee: number;
  discount: number;
  payment_method: PaymentMethod;
  instructions: string | null;
  internal_note: string | null;
};

export function EditOrderDetails({ order, deliveryLocked }: { order: EditableOrder; deliveryLocked: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [v, setV] = React.useState(order);
  const [point, setPoint] = React.useState<LatLng | null>(order.delivery_lat != null && order.delivery_lng != null ? { lat: order.delivery_lat, lng: order.delivery_lng } : null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);

  async function save() {
    setPending(true);
    const res = await updateOrderDetailsAction(order.id, { ...v, delivery_lat: point?.lat ?? null, delivery_lng: point?.lng ?? null });
    setPending(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(t(res.error));
      return;
    }
    toast.success(t("Commande mise à jour."));
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Pencil /> {t("Modifier")}
      </Button>
      <DialogContent
        size="lg"
        title={t("Modifier la commande")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("Annuler")}
            </Button>
            <Button variant="primary" loading={pending} onClick={save}>
              {t("Enregistrer")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("Client")} htmlFor="e-name" error={errors.customer_name}>
              <Input id="e-name" value={v.customer_name} onChange={(e) => setV({ ...v, customer_name: e.target.value })} />
            </Field>
            <Field label={t("Téléphone")} htmlFor="e-phone" error={errors.customer_phone}>
              <Input id="e-phone" type="tel" value={v.customer_phone} onChange={(e) => setV({ ...v, customer_phone: e.target.value })} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("Mode")} htmlFor="e-mode" hint={deliveryLocked ? t("Une course est en cours : le mode ne peut pas changer.") : undefined}>
              <NativeSelect id="e-mode" disabled={deliveryLocked} value={v.delivery_mode} onChange={(e) => setV({ ...v, delivery_mode: e.target.value as "delivery" | "pickup" })}>
                <option value="delivery">{t("Livraison")}</option>
                <option value="pickup">{t("Retrait en boutique")}</option>
              </NativeSelect>
            </Field>
            <Field label={t("Moyen de paiement")} htmlFor="e-method">
              <NativeSelect id="e-method" value={v.payment_method} onChange={(e) => setV({ ...v, payment_method: e.target.value as PaymentMethod })}>
                {(Object.keys(PAYMENT_METHOD) as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {t(PAYMENT_METHOD[m])}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          {v.delivery_mode === "delivery" ? (
            <>
              <Field label={t("Adresse de livraison")} htmlFor="e-address" error={errors.delivery_address}>
                <Input id="e-address" value={v.delivery_address ?? ""} onChange={(e) => setV({ ...v, delivery_address: e.target.value })} />
              </Field>
              <LocationPicker value={point} onChange={setPoint} kind="dropoff" height={200} />
            </>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("Frais de livraison")} htmlFor="e-fee" error={errors.delivery_fee}>
              <InputGroup id="e-fee" type="number" min={0} suffix="FCFA" value={v.delivery_fee} onChange={(e) => setV({ ...v, delivery_fee: Number(e.target.value) || 0 })} disabled={v.delivery_mode === "pickup"} />
            </Field>
            <Field label={t("Remise")} htmlFor="e-discount" error={errors.discount}>
              <InputGroup id="e-discount" type="number" min={0} suffix="FCFA" value={v.discount} onChange={(e) => setV({ ...v, discount: Number(e.target.value) || 0 })} />
            </Field>
          </div>
          <Field label={t("Instructions de livraison")} htmlFor="e-instr" optional>
            <Textarea id="e-instr" rows={2} value={v.instructions ?? ""} onChange={(e) => setV({ ...v, instructions: e.target.value })} />
          </Field>
          <Field label={t("Note interne")} htmlFor="e-note" optional>
            <Textarea id="e-note" rows={2} value={v.internal_note ?? ""} onChange={(e) => setV({ ...v, internal_note: e.target.value })} />
          </Field>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EditOrderItems({
  orderId,
  products,
  items,
  currency,
}: {
  orderId: string;
  products: CatalogProduct[];
  items: { product_id: string | null; variant_id: string | null; name: string; unit_price: number; quantity: number }[];
  currency: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [lines, setLines] = React.useState<ItemLine[]>(() => items.map((i) => ({ ...i, key: newKey() })));
  const [pending, setPending] = React.useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setLines(items.map((i) => ({ ...i, key: newKey() })));
      }}
    >
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Pencil /> {t("Modifier les articles")}
      </Button>
      <DialogContent
        size="xl"
        title={t("Modifier les articles")}
        description={t("Le stock est recalculé automatiquement.")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("Annuler")}
            </Button>
            <Button
              variant="primary"
              loading={pending}
              onClick={async () => {
                setPending(true);
                const res = await setOrderItemsAction(orderId, lines.map(({ key: _key, ...l }) => l));
                setPending(false);
                if (!res.ok) return toast.error(t(res.error));
                toast.success(t("Articles mis à jour."));
                setOpen(false);
                router.refresh();
              }}
            >
              {t("Enregistrer")}
            </Button>
          </>
        }
      >
        <ItemEditor products={products} lines={lines} onChange={setLines} currency={currency} />
      </DialogContent>
    </Dialog>
  );
}
