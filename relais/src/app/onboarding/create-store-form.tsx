"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createStoreAction } from "@/lib/actions/store";
import { Field } from "@/components/ui/field";
import { Input, InputGroup, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/page";
import { slugify } from "@/lib/utils";

const CATEGORIES = ["Mode et vêtements", "Beauté et cosmétiques", "Alimentation", "Restauration", "Électronique", "Maison et décoration", "Santé et pharmacie", "Librairie et papeterie", "Autre"];

export function CreateStoreForm({ siteHost }: { siteHost: string }) {
  const router = useRouter();
  const [values, setValues] = React.useState({ name: "", slug: "", category: "", phone: "", whatsapp: "", city: "", address: "", default_delivery_fee: "" });
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function set<K extends keyof typeof values>(key: K, value: string) {
    setValues((v) => {
      const next = { ...v, [key]: value };
      if (key === "name" && !slugTouched) next.slug = slugify(value);
      return next;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      const res = await createStoreAction({ ...values, default_delivery_fee: values.default_delivery_fee || 0 });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
        return;
      }
      toast.success("Boutique créée.");
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {formError ? <Notice tone="danger">{formError}</Notice> : null}
      <Field label="Nom de la boutique" htmlFor="name" error={errors.name}>
        <Input id="name" value={values.name} onChange={(e) => set("name", e.target.value)} required autoFocus />
      </Field>
      <Field label="Adresse de votre page publique" htmlFor="slug" error={errors.slug} hint="Lettres minuscules, chiffres et tirets.">
        <div className="flex items-center rounded-md border border-line-strong bg-subtle shadow-xs focus-within:border-accent focus-within:shadow-focus">
          <span className="pl-3 text-[13px] whitespace-nowrap text-ink-3">{siteHost}/shop/</span>
          <input
            id="slug"
            value={values.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
            }}
            className="h-9 min-w-0 flex-1 rounded-r-md bg-surface px-2 text-[13.5px] outline-none"
            required
          />
        </div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Téléphone" htmlFor="phone" error={errors.phone}>
          <Input id="phone" type="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} required />
        </Field>
        <Field label="WhatsApp" htmlFor="whatsapp" error={errors.whatsapp} optional>
          <Input id="whatsapp" type="tel" value={values.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="Si différent" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Catégorie" htmlFor="category" optional>
          <NativeSelect id="category" value={values.category} onChange={(e) => set("category", e.target.value)}>
            <option value="">Choisir…</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Ville" htmlFor="city" optional>
          <Input id="city" value={values.city} onChange={(e) => set("city", e.target.value)} placeholder="Douala" />
        </Field>
      </div>
      <Field label="Adresse (point de collecte des livreurs)" htmlFor="address" optional hint="Vous pourrez placer le point exact sur la carte ensuite.">
        <Input id="address" value={values.address} onChange={(e) => set("address", e.target.value)} placeholder="Quartier, rue, repère" />
      </Field>
      <Field label="Frais de livraison par défaut" htmlFor="fee" error={errors.default_delivery_fee} optional>
        <InputGroup id="fee" type="number" min={0} step={100} inputMode="numeric" suffix="FCFA" value={values.default_delivery_fee} onChange={(e) => set("default_delivery_fee", e.target.value)} />
      </Field>
      <Button type="submit" variant="primary" size="lg" loading={pending} className="mt-2">
        Créer la boutique
      </Button>
    </form>
  );
}
