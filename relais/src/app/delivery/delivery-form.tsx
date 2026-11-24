"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Package, Box, Boxes, GlassWater, UtensilsCrossed } from "lucide-react";
import { createOnDemandAction, quoteDeliveryAction } from "@/lib/actions/public";
import { LocationPicker } from "@/components/map/location-picker";
import { Field } from "@/components/ui/field";
import { Input, InputGroup, NativeSelect, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/switch";
import { Notice } from "@/components/ui/page";
import { formatDistanceKm, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LatLng } from "@/lib/geo";
import type { DeliveryQuote } from "@/types/domain";

const PACKAGES = [
  { key: "document", label: "Document", icon: FileText },
  { key: "small", label: "Petit colis", icon: Package },
  { key: "medium", label: "Colis moyen", icon: Box },
  { key: "large", label: "Grand colis", icon: Boxes },
  { key: "fragile", label: "Fragile", icon: GlassWater },
  { key: "food", label: "Repas", icon: UtensilsCrossed },
] as const;

function Step({ n, title, children, description }: { n: number; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-5 shadow-xs">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">{n}</span>
        <div>
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {description ? <p className="text-[13px] text-ink-3">{description}</p> : null}
        </div>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function DeliveryForm({ defaults }: { defaults: { name: string; phone: string } }) {
  const router = useRouter();
  const [sender, setSender] = React.useState(defaults);
  const [pickupAddress, setPickupAddress] = React.useState("");
  const [pickup, setPickup] = React.useState<LatLng | null>(null);
  const [recipient, setRecipient] = React.useState({ name: "", phone: "" });
  const [dropoffAddress, setDropoffAddress] = React.useState("");
  const [dropoff, setDropoff] = React.useState<LatLng | null>(null);
  const [packageType, setPackageType] = React.useState<string>("small");
  const [description, setDescription] = React.useState("");
  const [instructions, setInstructions] = React.useState("");
  const [payment, setPayment] = React.useState("cash_on_delivery");
  const [payer, setPayer] = React.useState<"sender" | "recipient">("sender");
  const [collect, setCollect] = React.useState(false);
  const [collectAmount, setCollectAmount] = React.useState("");
  const [quote, setQuote] = React.useState<DeliveryQuote | null>(null);
  const [quoteError, setQuoteError] = React.useState<string | null>(null);
  const [quoting, setQuoting] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (!pickup || !dropoff) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    setQuoting(true);
    const id = setTimeout(async () => {
      const res = await quoteDeliveryAction({ pickup, dropoff, package_type: packageType });
      if (cancelled) return;
      setQuoting(false);
      if (!res.ok) {
        setQuote(null);
        setQuoteError(res.error);
      } else {
        setQuote(res.data);
        setQuoteError(null);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [pickup, dropoff, packageType]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!quote) {
      setFormError("Placez le point de collecte et la destination sur la carte pour obtenir le prix.");
      return;
    }
    setPending(true);
    setFormError(null);
    const res = await createOnDemandAction({
      sender,
      pickup: { address: pickupAddress, lat: pickup?.lat, lng: pickup?.lng },
      recipient,
      dropoff: { address: dropoffAddress, lat: dropoff?.lat, lng: dropoff?.lng },
      package_type: packageType,
      description,
      instructions,
      payment_method: payment,
      payer,
      collect_amount: collect ? Number(collectAmount) || 0 : 0,
      expected_price: quote.price,
    });
    setPending(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      setFormError(res.error);
      if (res.error.includes("tarif")) {
        const q = await quoteDeliveryAction({ pickup: pickup!, dropoff: dropoff!, package_type: packageType });
        if (q.ok) setQuote(q.data);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    toast.success(`Demande ${res.data.reference} enregistrée.`);
    router.push(`/track/${res.data.tracking_token}?new=1`);
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-5">
        {formError ? <Notice tone="danger">{formError}</Notice> : null}
        <Step n={1} title="Collecte" description="Où le livreur récupère-t-il le colis ?">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Votre nom" htmlFor="d-sname" error={errors["sender.name"]}>
              <Input id="d-sname" value={sender.name} onChange={(e) => setSender({ ...sender, name: e.target.value })} autoComplete="name" />
            </Field>
            <Field label="Votre téléphone" htmlFor="d-sphone" error={errors["sender.phone"]}>
              <Input id="d-sphone" type="tel" value={sender.phone} onChange={(e) => setSender({ ...sender, phone: e.target.value })} autoComplete="tel" />
            </Field>
          </div>
          <Field label="Adresse de collecte" htmlFor="d-paddr" error={errors["pickup.address"]} hint="Quartier, rue, point de repère.">
            <Input id="d-paddr" value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} />
          </Field>
          <Field label="Position de collecte" error={errors["pickup.lat"]}>
            <LocationPicker value={pickup} onChange={setPickup} onAddress={(l) => !pickupAddress && setPickupAddress(l)} kind="pickup" height={220} />
          </Field>
        </Step>

        <Step n={2} title="Livraison" description="À qui et où livrer ?">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom du destinataire" htmlFor="d-rname" error={errors["recipient.name"]}>
              <Input id="d-rname" value={recipient.name} onChange={(e) => setRecipient({ ...recipient, name: e.target.value })} />
            </Field>
            <Field label="Téléphone du destinataire" htmlFor="d-rphone" error={errors["recipient.phone"]}>
              <Input id="d-rphone" type="tel" value={recipient.phone} onChange={(e) => setRecipient({ ...recipient, phone: e.target.value })} />
            </Field>
          </div>
          <Field label="Adresse de destination" htmlFor="d-daddr" error={errors["dropoff.address"]}>
            <Input id="d-daddr" value={dropoffAddress} onChange={(e) => setDropoffAddress(e.target.value)} />
          </Field>
          <Field label="Position de destination" error={errors["dropoff.lat"]}>
            <LocationPicker value={dropoff} onChange={setDropoff} onAddress={(l) => !dropoffAddress && setDropoffAddress(l)} kind="dropoff" height={220} />
          </Field>
        </Step>

        <Step n={3} title="Colis">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {PACKAGES.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setPackageType(key)}
                aria-pressed={packageType === key}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-md border px-2 py-3 text-xs font-medium transition-colors",
                  packageType === key ? "border-accent bg-accent-soft/60 text-ink shadow-[inset_0_0_0_1px_var(--color-accent)]" : "border-line-strong text-ink-2 hover:bg-subtle",
                )}
              >
                <Icon className={cn("size-5", packageType === key ? "text-accent" : "text-ink-3")} />
                {label}
              </button>
            ))}
          </div>
          <Field label="Description" htmlFor="d-desc" optional>
            <Input id="d-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex. enveloppe A4, carton de 5 kg…" />
          </Field>
          <Field label="Instructions pour le livreur" htmlFor="d-instr" optional>
            <Textarea id="d-instr" rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          </Field>
        </Step>

        <Step n={4} title="Paiement" description="Paiement à la livraison ou mobile money confirmé manuellement. Aucun prélèvement automatique.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Moyen de paiement" htmlFor="d-pay">
              <NativeSelect id="d-pay" value={payment} onChange={(e) => setPayment(e.target.value)}>
                <option value="cash_on_delivery">Espèces au livreur</option>
                <option value="orange_money">Orange Money (confirmation manuelle)</option>
                <option value="mtn_momo">MTN MoMo (confirmation manuelle)</option>
              </NativeSelect>
            </Field>
            <Field label="Qui paie la course ?" htmlFor="d-payer">
              <NativeSelect id="d-payer" value={payer} onChange={(e) => setPayer(e.target.value as "sender" | "recipient")}>
                <option value="sender">L&apos;expéditeur (moi)</option>
                <option value="recipient">Le destinataire</option>
              </NativeSelect>
            </Field>
          </div>
          <label className="flex items-start gap-2.5 text-[13.5px]">
            <Checkbox className="mt-0.5" checked={collect} onCheckedChange={(c) => setCollect(c === true)} />
            <span>
              Le livreur doit encaisser un montant auprès du destinataire
              <span className="block text-xs text-ink-3">Par exemple le prix d&apos;un article que vous vendez.</span>
            </span>
          </label>
          {collect ? (
            <Field label="Montant à encaisser" htmlFor="d-collect" error={errors.collect_amount} className="sm:max-w-[220px]">
              <InputGroup id="d-collect" type="number" min={0} suffix="FCFA" value={collectAmount} onChange={(e) => setCollectAmount(e.target.value)} />
            </Field>
          ) : null}
        </Step>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <section className="rounded-lg border border-line bg-surface shadow-xs">
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="text-[14px] font-semibold">Prix de la course</h2>
          </div>
          <div className="px-5 py-4">
            {quote ? (
              <>
                <p className="text-[26px] leading-8 font-semibold tabular">{formatMoney(quote.price, quote.currency)}</p>
                <dl className="mt-3 space-y-1.5 text-[13px]">
                  <div className="flex justify-between">
                    <dt className="text-ink-3">Distance (à vol d&apos;oiseau)</dt>
                    <dd className="tabular">{formatDistanceKm(quote.distance_km)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-3">Prise en charge</dt>
                    <dd className="tabular">{formatMoney(quote.breakdown.base_fee, quote.currency)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-3">Distance × {formatMoney(quote.breakdown.per_km_fee, quote.currency)}/km</dt>
                    <dd className="tabular">{formatMoney(quote.breakdown.distance_fee, quote.currency)}</dd>
                  </div>
                  {quote.breakdown.surcharge > 0 ? (
                    <div className="flex justify-between">
                      <dt className="text-ink-3">Supplément colis</dt>
                      <dd className="tabular">{formatMoney(quote.breakdown.surcharge, quote.currency)}</dd>
                    </div>
                  ) : null}
                </dl>
                <p className="mt-3 text-xs text-ink-3">Minimum {formatMoney(quote.breakdown.min_fee, quote.currency)}, arrondi à {quote.breakdown.rounding} près. Prix recalculé par le serveur à la validation.</p>
              </>
            ) : quoting && pickup && dropoff ? (
              <p className="text-[13px] text-ink-3">Calcul du prix…</p>
            ) : quoteError ? (
              <p className="text-[13px] text-danger-ink">{quoteError}</p>
            ) : (
              <p className="text-[13px] text-ink-3">Placez la collecte et la destination sur la carte pour afficher le prix.</p>
            )}
            {collect && Number(collectAmount) > 0 ? (
              <p className="mt-3 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning-ink">
                À encaisser auprès du destinataire : {formatMoney(Number(collectAmount), quote?.currency ?? "XAF")}
              </p>
            ) : null}
          </div>
          <div className="border-t border-line px-5 py-4">
            <Button type="submit" variant="primary" size="lg" block loading={pending} disabled={!quote}>
              Confirmer la demande
            </Button>
            <p className="mt-2 text-center text-xs text-ink-3">Vous recevrez un lien de suivi à partager.</p>
          </div>
        </section>
      </aside>
    </form>
  );
}
