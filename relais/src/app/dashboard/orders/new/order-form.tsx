"use client";

import { useI18n } from "@/i18n/client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, UserRound, X } from "lucide-react";
import { createOrderAction } from "@/lib/actions/orders";
import { searchCustomersAction, type CustomerOption } from "@/lib/actions/customers";
import { ItemEditor, type CatalogProduct, type ItemLine } from "@/components/orders/item-editor";
import { LocationPicker } from "@/components/map/location-picker";
import { Field, FormSection } from "@/components/ui/field";
import { Input, InputGroup, NativeSelect, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/switch";
import { Notice } from "@/components/ui/page";
import { Panel } from "@/components/ui/panel";
import { formatPhone } from "@/lib/phone";
import { ORDER_SOURCE, PAYMENT_METHOD } from "@/lib/status";
import type { LatLng } from "@/lib/geo";
import { cn } from "@/lib/utils";
import type { PaymentMethod } from "@/types/domain";

type Props = {
  products: CatalogProduct[];
  currency: string;
  defaultFee: number;
  acceptedMethods: PaymentMethod[];
  initialCustomer: CustomerOption | null;
};

export function OrderForm({ products, currency, defaultFee, acceptedMethods, initialCustomer }: Props) {
  const { t, f } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  const [customer, setCustomer] = React.useState<CustomerOption | null>(initialCustomer);
  const [mode, setMode] = React.useState<"existing" | "new">(initialCustomer ? "existing" : "new");
  const [newCustomer, setNewCustomer] = React.useState({ name: "", phone: "" });
  const [results, setResults] = React.useState<CustomerOption[]>([]);
  const [customerQuery, setCustomerQuery] = React.useState("");

  const [lines, setLines] = React.useState<ItemLine[]>([]);
  const [deliveryMode, setDeliveryMode] = React.useState<"delivery" | "pickup">("delivery");
  const [address, setAddress] = React.useState(initialCustomer?.address ?? "");
  const [point, setPoint] = React.useState<LatLng | null>(
    initialCustomer?.lat != null && initialCustomer?.lng != null ? { lat: initialCustomer.lat, lng: initialCustomer.lng } : null,
  );
  const [fee, setFee] = React.useState(String(defaultFee));
  const [discount, setDiscount] = React.useState("0");
  const [method, setMethod] = React.useState<PaymentMethod>(acceptedMethods[0] ?? "cash_on_delivery");
  const [markPaid, setMarkPaid] = React.useState(false);
  const [source, setSource] = React.useState<keyof typeof ORDER_SOURCE>("whatsapp");
  const [status, setStatus] = React.useState<"new" | "confirmed">("confirmed");
  const [instructions, setInstructions] = React.useState("");
  const [internalNote, setInternalNote] = React.useState("");

  React.useEffect(() => {
    if (mode !== "existing") return;
    const id = setTimeout(async () => setResults(await searchCustomersAction(customerQuery)), 250);
    return () => clearTimeout(id);
  }, [customerQuery, mode]);

  const subtotal = lines.reduce((s, l) => s + l.unit_price * l.quantity, 0);
  const feeValue = deliveryMode === "pickup" ? 0 : Math.max(0, Number(fee) || 0);
  const discountValue = Math.max(0, Number(discount) || 0);
  const total = Math.max(0, subtotal + feeValue - discountValue);

  function pickCustomer(c: CustomerOption) {
    setCustomer(c);
    if (c.address) setAddress(c.address);
    if (c.lat != null && c.lng != null) setPoint({ lat: c.lat, lng: c.lng });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const payload = {
      customer_id: mode === "existing" ? customer?.id ?? null : null,
      customer: mode === "existing" ? { name: customer?.full_name ?? "", phone: customer?.phone ?? "" } : newCustomer,
      source,
      status,
      delivery_mode: deliveryMode,
      delivery_address: deliveryMode === "delivery" ? address : "",
      delivery_lat: deliveryMode === "delivery" ? point?.lat ?? null : null,
      delivery_lng: deliveryMode === "delivery" ? point?.lng ?? null : null,
      delivery_fee: feeValue,
      discount: discountValue,
      payment_method: method,
      mark_paid: markPaid,
      instructions,
      internal_note: internalNote,
      items: lines.map((l) => ({ product_id: l.product_id, variant_id: l.variant_id, name: l.name, unit_price: l.unit_price, quantity: l.quantity })),
    };
    if (mode === "existing" && !customer) {
      setErrors({ customer: t("Sélectionnez un client ou créez-en un nouveau.") });
      return;
    }
    startTransition(async () => {
      const res = await createOrderAction(payload);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      toast.success(t("Commande {ref} créée.", { ref: res.data.reference }));
      router.push(`/dashboard/orders/${res.data.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]" noValidate>
      <Panel className="px-5 sm:px-7">
        {formError ? <Notice tone="danger" className="mt-5">{t(formError)}</Notice> : null}
        <FormSection title={t("Client")} description={t("Recherchez un client existant ou saisissez un nouveau contact.")}>
          <div className="inline-flex w-fit rounded-md border border-line bg-subtle p-0.5">
            {(["existing", "new"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn("h-7 rounded-sm px-3 text-[13px] font-medium", mode === m ? "bg-surface text-ink shadow-xs" : "text-ink-3 hover:text-ink")}
              >
                {m === "existing" ? t("Client existant") : t("Nouveau client")}
              </button>
            ))}
          </div>
          {mode === "existing" ? (
            customer ? (
              <div className="flex items-center gap-3 rounded-md border border-line bg-subtle px-3 py-2.5">
                <UserRound className="size-4 text-ink-3" />
                <div className="min-w-0 flex-1 text-[13.5px]">
                  <p className="font-medium text-ink">{customer.full_name}</p>
                  <p className="text-xs text-ink-3">
                    {formatPhone(customer.phone)}
                    {customer.address ? ` · ${customer.address}` : ""}
                  </p>
                </div>
                <Button type="button" size="icon-sm" variant="ghost" aria-label={t("Changer de client")} onClick={() => setCustomer(null)}>
                  <X />
                </Button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-4" />
                  <Input value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} placeholder={t("Nom ou téléphone")} className="pl-8" aria-invalid={Boolean(errors.customer)} />
                </div>
                <ul className="mt-2 divide-y divide-line overflow-hidden rounded-md border border-line">
                  {results.length === 0 ? <li className="px-3 py-2.5 text-[13px] text-ink-3">{t("Aucun client trouvé.")}</li> : null}
                  {results.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => pickCustomer(c)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] hover:bg-subtle">
                        <span className="font-medium text-ink">{c.full_name}</span>
                        <span className="text-ink-3 tabular">{formatPhone(c.phone)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {errors.customer ? <p className="mt-1.5 text-xs text-danger-ink">{errors.customer}</p> : null}
              </div>
            )
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("Nom")} htmlFor="c-name" error={errors["customer.name"]}>
                <Input id="c-name" value={newCustomer.name} onChange={(e) => setNewCustomer((v) => ({ ...v, name: e.target.value }))} aria-invalid={Boolean(errors["customer.name"])} />
              </Field>
              <Field label={t("Téléphone / WhatsApp")} htmlFor="c-phone" error={errors["customer.phone"]}>
                <Input id="c-phone" type="tel" value={newCustomer.phone} onChange={(e) => setNewCustomer((v) => ({ ...v, phone: e.target.value }))} aria-invalid={Boolean(errors["customer.phone"])} />
              </Field>
            </div>
          )}
        </FormSection>

        <FormSection title={t("Articles")} description={t("Le prix catalogue est proposé ; vous pouvez l'ajuster (prix négocié).")}>
          <ItemEditor products={products} lines={lines} onChange={setLines} currency={currency} error={errors.items} />
        </FormSection>

        <FormSection title={t("Livraison")}>
          <div className="inline-flex w-fit rounded-md border border-line bg-subtle p-0.5">
            {(["delivery", "pickup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setDeliveryMode(m)}
                className={cn("h-7 rounded-sm px-3 text-[13px] font-medium", deliveryMode === m ? "bg-surface text-ink shadow-xs" : "text-ink-3 hover:text-ink")}
              >
                {m === "delivery" ? t("Livraison") : t("Retrait en boutique")}
              </button>
            ))}
          </div>
          {deliveryMode === "delivery" ? (
            <>
              <Field label={t("Adresse de livraison")} htmlFor="address" error={errors.delivery_address} hint={t("Quartier, rue, point de repère.")}>
                <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} aria-invalid={Boolean(errors.delivery_address)} />
              </Field>
              <Field label={t("Position exacte")} optional hint={t("Permet au livreur de naviguer directement vers le client.")}>
                <LocationPicker value={point} onChange={setPoint} onAddress={(label) => !address && setAddress(label)} kind="dropoff" height={220} />
              </Field>
              <Field label={t("Frais de livraison")} htmlFor="fee" className="sm:max-w-[220px]">
                <InputGroup id="fee" type="number" min={0} step={100} suffix="FCFA" value={fee} onChange={(e) => setFee(e.target.value)} />
              </Field>
            </>
          ) : (
            <p className="text-[13px] text-ink-3">{t("Le client récupère sa commande à la boutique : aucune course n'est créée.")}</p>
          )}
        </FormSection>

        <FormSection title={t("Paiement")} description={t("Aucun paiement n'est débité automatiquement : les montants sont confirmés manuellement.")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("Moyen de paiement")} htmlFor="method">
              <NativeSelect id="method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {(Object.keys(PAYMENT_METHOD) as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {t(PAYMENT_METHOD[m])}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t("Remise")} htmlFor="discount" optional>
              <InputGroup id="discount" type="number" min={0} step={100} suffix="FCFA" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </Field>
          </div>
          <label className="flex items-center gap-2.5 text-[13.5px] text-ink">
            <Checkbox checked={markPaid} onCheckedChange={(v) => setMarkPaid(v === true)} />
            {t("Le client a déjà payé la totalité ({amount})", { amount: f.money(total, currency) })}
          </label>
        </FormSection>

        <FormSection title={t("Origine et notes")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("Reçue via")} htmlFor="source">
              <NativeSelect id="source" value={source} onChange={(e) => setSource(e.target.value as keyof typeof ORDER_SOURCE)}>
                {Object.entries(ORDER_SOURCE)
                  .filter(([k]) => k !== "storefront")
                  .map(([k, label]) => (
                    <option key={k} value={k}>
                      {t(label)}
                    </option>
                  ))}
              </NativeSelect>
            </Field>
            <Field label={t("Statut initial")} htmlFor="status">
              <NativeSelect id="status" value={status} onChange={(e) => setStatus(e.target.value as "new" | "confirmed")}>
                <option value="confirmed">{t("Confirmée")}</option>
                <option value="new">{t("Nouvelle (à confirmer)")}</option>
              </NativeSelect>
            </Field>
          </div>
          <Field label={t("Instructions de livraison")} htmlFor="instructions" optional hint={t("Visibles par le livreur.")}>
            <Textarea id="instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} />
          </Field>
          <Field label={t("Note interne")} htmlFor="internal" optional hint={t("Visible uniquement par l'équipe de la boutique.")}>
            <Textarea id="internal" value={internalNote} onChange={(e) => setInternalNote(e.target.value)} rows={2} />
          </Field>
        </FormSection>
      </Panel>

      <aside className="lg:sticky lg:top-[72px] lg:self-start">
        <Panel>
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="text-[14px] font-semibold">{t("Récapitulatif")}</h2>
          </div>
          <dl className="space-y-2 px-5 py-4 text-[13.5px]">
            <div className="flex justify-between">
              <dt className="text-ink-3">{t("Articles ({n})", { n: lines.reduce((s, l) => s + l.quantity, 0) })}</dt>
              <dd className="tabular">{f.money(subtotal, currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-3">{t("Livraison")}</dt>
              <dd className="tabular">{f.money(feeValue, currency)}</dd>
            </div>
            {discountValue > 0 ? (
              <div className="flex justify-between">
                <dt className="text-ink-3">{t("Remise")}</dt>
                <dd className="tabular">− {f.money(discountValue, currency)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-line pt-3 text-[15px] font-semibold">
              <dt>{t("Total")}</dt>
              <dd className="tabular">{f.money(total, currency)}</dd>
            </div>
          </dl>
          <div className="border-t border-line px-5 py-4">
            <Button type="submit" variant="primary" size="lg" block loading={pending}>
              {t("Créer la commande")}
            </Button>
            <p className="mt-2 text-center text-xs text-ink-3">{t("Le stock des produits suivis est déduit automatiquement.")}</p>
          </div>
        </Panel>
      </aside>
    </form>
  );
}
