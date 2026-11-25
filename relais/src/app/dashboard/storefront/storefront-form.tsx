"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { updateStoreSettingsAction } from "@/lib/actions/store";
import { LocationPicker } from "@/components/map/location-picker";
import { SingleImageField } from "@/components/ui/single-image";
import { Field, FormSection } from "@/components/ui/field";
import { Input, InputGroup, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox, Switch, ToggleRow } from "@/components/ui/switch";
import { Panel } from "@/components/ui/panel";
import { Notice } from "@/components/ui/page";
import { CopyButton } from "@/components/ui/client-helpers";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { PAYMENT_METHODS } from "@/lib/payments";
import { whatsappShareUrl } from "@/lib/whatsapp";
import type { OpeningHoursDay, PaymentMethod } from "@/types/domain";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export type StorefrontValue = {
  name: string;
  slug: string;
  description: string;
  category: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
  lat: number | null;
  lng: number | null;
  logo_path: string | null;
  banner_path: string | null;
  opening_hours: OpeningHoursDay[];
  delivery_terms: string;
  default_delivery_fee: string;
  accepted_payment_methods: PaymentMethod[];
  is_published: boolean;
};

export function StorefrontForm({ storeId, initial, siteUrl }: { storeId: string; initial: StorefrontValue; siteUrl: string }) {
  const router = useRouter();
  const [v, setV] = React.useState(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);
  const set = <K extends keyof StorefrontValue>(k: K, value: StorefrontValue[K]) => setV((p) => ({ ...p, [k]: value }));
  const shopUrl = `${siteUrl}/shop/${initial.slug}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await updateStoreSettingsAction({ ...v, default_delivery_fee: Number(v.default_delivery_fee) || 0 });
    setPending(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(res.error);
      return;
    }
    setErrors({});
    toast.success("Boutique enregistrée.");
    router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Panel className="px-5 sm:px-7">
        <FormSection title="Identité" description="Ce que voient vos clients sur la page publique.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom" htmlFor="s-name" error={errors.name}>
              <Input id="s-name" value={v.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Catégorie" htmlFor="s-cat" optional>
              <Input id="s-cat" value={v.category} onChange={(e) => set("category", e.target.value)} />
            </Field>
          </div>
          <Field label="Adresse de la page" htmlFor="s-slug" error={errors.slug} hint="Changer l'adresse rend les anciens liens partagés invalides.">
            <div className="flex items-center rounded-md border border-line-strong bg-subtle shadow-xs focus-within:border-accent focus-within:shadow-focus">
              <span className="pl-3 text-[13px] whitespace-nowrap text-ink-3">/shop/</span>
              <input id="s-slug" value={v.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} className="h-9 min-w-0 flex-1 rounded-r-md bg-surface px-2 text-[13.5px] outline-none" />
            </div>
          </Field>
          <Field label="Description" htmlFor="s-desc" optional>
            <Textarea id="s-desc" rows={3} value={v.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <Field label="Logo">
            <SingleImageField storeId={storeId} folder="brand" value={v.logo_path} onChange={(p) => set("logo_path", p)} maxSize={600} />
          </Field>
          <Field label="Bannière" hint="Format paysage, au moins 1200 px de large.">
            <SingleImageField storeId={storeId} folder="brand" value={v.banner_path} onChange={(p) => set("banner_path", p)} aspect="banner" maxSize={1800} />
          </Field>
        </FormSection>

        <FormSection title="Contact">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Téléphone" htmlFor="s-phone" error={errors.phone} optional>
              <Input id="s-phone" type="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field label="WhatsApp" htmlFor="s-wa" error={errors.whatsapp} optional hint="Utilisé par le bouton WhatsApp de la boutique.">
              <Input id="s-wa" type="tel" value={v.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
            </Field>
            <Field label="E-mail" htmlFor="s-email" error={errors.email} optional>
              <Input id="s-email" type="email" value={v.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Localisation" description="Point de collecte des livreurs. La position exacte sert à calculer les distances.">
          <div id="localisation" className="grid scroll-mt-24 gap-4 sm:grid-cols-[1fr_200px]">
            <Field label="Adresse" htmlFor="s-address" optional>
              <Input id="s-address" value={v.address} onChange={(e) => set("address", e.target.value)} placeholder="Quartier, rue, repère" />
            </Field>
            <Field label="Ville" htmlFor="s-city" optional>
              <Input id="s-city" value={v.city} onChange={(e) => set("city", e.target.value)} />
            </Field>
          </div>
          <LocationPicker
            value={v.lat != null && v.lng != null ? { lat: v.lat, lng: v.lng } : null}
            onChange={(p) => setV((prev) => ({ ...prev, lat: p?.lat ?? null, lng: p?.lng ?? null }))}
            onAddress={(label) => !v.address && set("address", label)}
            kind="pickup"
            height={240}
          />
        </FormSection>

        <FormSection title="Horaires">
          <div className="overflow-hidden rounded-md border border-line">
            {v.opening_hours.map((d, i) => (
              <div key={d.day} className="flex flex-wrap items-center gap-3 border-b border-line px-3 py-2 last:border-0">
                <span className="w-24 text-[13.5px]">{DAYS[d.day - 1]}</span>
                <label className="flex items-center gap-2 text-xs text-ink-2">
                  <Switch checked={!d.closed} onCheckedChange={(c) => set("opening_hours", v.opening_hours.map((x, j) => (j === i ? { ...x, closed: !c } : x)))} />
                  {d.closed ? "Fermé" : "Ouvert"}
                </label>
                {!d.closed ? (
                  <div className="flex items-center gap-1.5 text-[13px]">
                    <input type="time" value={d.open} onChange={(e) => set("opening_hours", v.opening_hours.map((x, j) => (j === i ? { ...x, open: e.target.value } : x)))} className="h-8 rounded-md border border-line-strong px-2 tabular" aria-label="Ouverture" />
                    <span className="text-ink-3">–</span>
                    <input type="time" value={d.close} onChange={(e) => set("opening_hours", v.opening_hours.map((x, j) => (j === i ? { ...x, close: e.target.value } : x)))} className="h-8 rounded-md border border-line-strong px-2 tabular" aria-label="Fermeture" />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </FormSection>

        <FormSection title="Livraison et paiement">
          <Field label="Frais de livraison par défaut" htmlFor="s-fee" error={errors.default_delivery_fee} className="sm:max-w-[220px]">
            <InputGroup id="s-fee" type="number" min={0} step={100} suffix="FCFA" value={v.default_delivery_fee} onChange={(e) => set("default_delivery_fee", e.target.value)} />
          </Field>
          <Field label="Conditions de livraison" htmlFor="s-terms" optional hint="Zones desservies, délais, frais particuliers…">
            <Textarea id="s-terms" rows={3} value={v.delivery_terms} onChange={(e) => set("delivery_terms", e.target.value)} />
          </Field>
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-ink-2">Moyens de paiement acceptés</legend>
            <div className="flex flex-col gap-2.5">
              {PAYMENT_METHODS.map((m) => (
                <label key={m.method} className="flex items-start gap-2.5 text-[13.5px]">
                  <Checkbox
                    className="mt-0.5"
                    checked={v.accepted_payment_methods.includes(m.method)}
                    onCheckedChange={(c) =>
                      set("accepted_payment_methods", c ? [...v.accepted_payment_methods, m.method] : v.accepted_payment_methods.filter((x) => x !== m.method))
                    }
                  />
                  <span>
                    <span className="font-medium text-ink">{m.label}</span>
                    <span className="block text-xs text-ink-3">{m.description}</span>
                  </span>
                </label>
              ))}
            </div>
            {errors.accepted_payment_methods ? <p className="mt-1.5 text-xs text-danger-ink">{errors.accepted_payment_methods}</p> : null}
          </fieldset>
          <Notice tone="neutral">Aucun paiement mobile n&apos;est débité automatiquement : vous confirmez la réception dans la fiche commande.</Notice>
        </FormSection>
      </Panel>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-[72px] lg:self-start">
        <Panel className="p-5">
          <ToggleRow id="publish" title="Boutique publiée" description="Visible par tous à son adresse publique." checked={v.is_published} onCheckedChange={(c) => set("is_published", c)} />
          <Button type="submit" variant="primary" size="lg" block className="mt-5" loading={pending}>
            Enregistrer
          </Button>
        </Panel>
        {initial.is_published ? (
          <Panel className="p-5">
            <p className="text-[13px] font-medium text-ink">Partager la boutique</p>
            <p className="mt-1 truncate font-mono text-xs text-ink-3">{shopUrl}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyButton value={shopUrl} label="Copier" />
              <WhatsAppButton size="sm" label="WhatsApp" href={whatsappShareUrl(`Découvrez ${initial.name} et commandez en ligne : ${shopUrl}`)} />
              <Button asChild size="sm" variant="ghost">
                <a href={`/shop/${initial.slug}`} target="_blank" rel="noopener noreferrer">
                  Voir <ExternalLink />
                </a>
              </Button>
            </div>
          </Panel>
        ) : (
          <Notice tone="warning" title="Boutique non publiée">
            Activez la publication pour rendre votre page accessible et recevoir des commandes en ligne.
          </Notice>
        )}
      </aside>
    </form>
  );
}
