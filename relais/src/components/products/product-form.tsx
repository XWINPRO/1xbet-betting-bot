"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { createCategoryAction, deleteProductAction, saveProductAction } from "@/lib/actions/products";
import { ImageListUploader } from "@/components/ui/image-uploader";
import { Field, FormSection } from "@/components/ui/field";
import { Input, InputGroup, NativeSelect, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Panel } from "@/components/ui/panel";
import { Notice } from "@/components/ui/page";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { ProductStatus, ProductVariant } from "@/types/domain";

export type ProductFormValue = {
  name: string;
  description: string;
  price: string;
  promo_price: string;
  category_id: string;
  sku: string;
  track_stock: boolean;
  stock: string;
  status: ProductStatus;
  images: string[];
  variants: ProductVariant[];
};

export function ProductForm({
  storeId,
  productId,
  initial,
  categories: initialCategories,
}: {
  storeId: string;
  productId: string | null;
  initial: ProductFormValue;
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [v, setV] = React.useState(initial);
  const [categories, setCategories] = React.useState(initialCategories);
  const [newCategory, setNewCategory] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const set = <K extends keyof ProductFormValue>(k: K, value: ProductFormValue[K]) => setV((prev) => ({ ...prev, [k]: value }));

  async function addCategory() {
    if (!newCategory.trim()) return;
    const res = await createCategoryAction(newCategory);
    if (!res.ok) return toast.error(res.error);
    setCategories((c) => [...c, res.data]);
    set("category_id", res.data.id);
    setNewCategory("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setFormError(null);
    const res = await saveProductAction(productId, {
      ...v,
      price: v.price === "" ? NaN : Number(v.price),
      promo_price: v.promo_price,
      stock: v.stock,
      category_id: v.category_id || null,
    });
    setPending(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      setFormError(res.error);
      return;
    }
    toast.success("Produit enregistré.");
    router.push("/dashboard/products");
    router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Panel className="px-5 sm:px-7">
        {formError ? <Notice tone="danger" className="mt-5">{formError}</Notice> : null}
        <FormSection title="Informations">
          <Field label="Nom du produit" htmlFor="p-name" error={errors.name}>
            <Input id="p-name" value={v.name} onChange={(e) => set("name", e.target.value)} aria-invalid={Boolean(errors.name)} />
          </Field>
          <Field label="Description" htmlFor="p-desc" optional>
            <Textarea id="p-desc" rows={4} value={v.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <Field label="Catégorie" htmlFor="p-cat" optional>
            <div className="flex flex-col gap-2 sm:flex-row">
              <NativeSelect id="p-cat" value={v.category_id} onChange={(e) => set("category_id", e.target.value)} className="sm:max-w-xs">
                <option value="">Sans catégorie</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
              <div className="flex flex-1 gap-2">
                <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Nouvelle catégorie" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void addCategory())} />
                <Button type="button" variant="secondary" onClick={() => void addCategory()} disabled={!newCategory.trim()}>
                  Créer
                </Button>
              </div>
            </div>
          </Field>
        </FormSection>

        <FormSection title="Photos" description="La première photo est utilisée dans la boutique et les partages.">
          <ImageListUploader storeId={storeId} value={v.images} onChange={(images) => set("images", images)} />
        </FormSection>

        <FormSection title="Prix">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prix" htmlFor="p-price" error={errors.price}>
              <InputGroup id="p-price" type="number" min={0} step={50} suffix="FCFA" value={v.price} onChange={(e) => set("price", e.target.value)} aria-invalid={Boolean(errors.price)} />
            </Field>
            <Field label="Prix promotionnel" htmlFor="p-promo" optional error={errors.promo_price} hint="Affiché barré à côté du prix normal.">
              <InputGroup id="p-promo" type="number" min={0} step={50} suffix="FCFA" value={v.promo_price} onChange={(e) => set("promo_price", e.target.value)} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Variantes" description="Tailles, couleurs, contenances… Un prix vide reprend le prix du produit.">
          {v.variants.length ? (
            <div className="overflow-hidden rounded-md border border-line">
              {v.variants.map((variant, i) => (
                <div key={variant.id} className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 last:border-0">
                  <Input
                    value={variant.name}
                    onChange={(e) => set("variants", v.variants.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    placeholder="Ex. Taille M"
                    className="h-8 min-w-[140px] flex-1"
                    aria-label="Nom de la variante"
                  />
                  <div className="w-36">
                    <InputGroup
                      type="number"
                      min={0}
                      suffix="FCFA"
                      className="h-8"
                      value={variant.price ?? ""}
                      onChange={(e) => set("variants", v.variants.map((x, j) => (j === i ? { ...x, price: e.target.value === "" ? null : Number(e.target.value) } : x)))}
                      aria-label="Prix de la variante"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-ink-2">
                    <Switch checked={variant.available} onCheckedChange={(c) => set("variants", v.variants.map((x, j) => (j === i ? { ...x, available: c } : x)))} />
                    Disponible
                  </label>
                  <Button type="button" size="icon-sm" variant="danger-ghost" aria-label="Supprimer la variante" onClick={() => set("variants", v.variants.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
          {errors["variants"] ? <p className="text-xs text-danger-ink">{errors["variants"]}</p> : null}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="self-start"
            onClick={() => set("variants", [...v.variants, { id: Math.random().toString(36).slice(2, 10), name: "", price: null, available: true }])}
          >
            <Plus /> Ajouter une variante
          </Button>
        </FormSection>

        <FormSection title="Stock" description="Activez le suivi pour décompter automatiquement les ventes.">
          <label className="flex items-center gap-3 text-[13.5px]">
            <Switch checked={v.track_stock} onCheckedChange={(c) => set("track_stock", c)} />
            Suivre le stock de ce produit
          </label>
          {v.track_stock ? (
            <Field label="Quantité disponible" htmlFor="p-stock" error={errors.stock} className="sm:max-w-[200px]">
              <Input id="p-stock" type="number" min={0} value={v.stock} onChange={(e) => set("stock", e.target.value)} />
            </Field>
          ) : null}
          <Field label="SKU / référence interne" htmlFor="p-sku" optional error={errors.sku} className="sm:max-w-xs">
            <Input id="p-sku" value={v.sku} onChange={(e) => set("sku", e.target.value)} />
          </Field>
        </FormSection>
      </Panel>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-[72px] lg:self-start">
        <Panel className="p-5">
          <Field label="Statut" htmlFor="p-status">
            <NativeSelect id="p-status" value={v.status} onChange={(e) => set("status", e.target.value as ProductStatus)}>
              <option value="active">En vente (visible en boutique)</option>
              <option value="inactive">Masqué</option>
              <option value="archived">Archivé</option>
            </NativeSelect>
          </Field>
          <Button type="submit" variant="primary" block size="lg" className="mt-5" loading={pending}>
            Enregistrer
          </Button>
        </Panel>
        {productId ? (
          <Button type="button" variant="danger-ghost" onClick={() => setDeleteOpen(true)}>
            <Trash2 /> Supprimer le produit
          </Button>
        ) : null}
      </aside>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent
          size="sm"
          title="Supprimer ce produit ?"
          description="Cette action est définitive. Les commandes existantes conservent le nom et le prix de l'article."
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
                Annuler
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  const res = await deleteProductAction(productId!);
                  if (!res.ok) return toast.error(res.error);
                  toast.success(res.message ?? "Supprimé.");
                  router.push("/dashboard/products");
                  router.refresh();
                }}
              >
                Supprimer
              </Button>
            </>
          }
        />
      </Dialog>
    </form>
  );
}
