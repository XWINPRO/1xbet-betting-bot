"use client";

import { useI18n } from "@/i18n/client";
import * as React from "react";
import { Minus, Package, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ProductVariant } from "@/types/domain";

export type CatalogProduct = {
  id: string;
  name: string;
  price: number;
  promo_price: number | null;
  status: string;
  track_stock: boolean;
  stock: number | null;
  variants: ProductVariant[];
};

export type ItemLine = {
  key: string;
  product_id: string | null;
  variant_id: string | null;
  name: string;
  unit_price: number;
  quantity: number;
};

let counter = 0;
export const newKey = () => `l${Date.now().toString(36)}${(counter++).toString(36)}`;

export function lineFromProduct(p: CatalogProduct): ItemLine {
  const variant = p.variants.find((v) => v.available) ?? null;
  return {
    key: newKey(),
    product_id: p.id,
    variant_id: variant?.id ?? null,
    name: p.name,
    unit_price: variant?.price ?? p.promo_price ?? p.price,
    quantity: 1,
  };
}

export function ItemEditor({
  products,
  lines,
  onChange,
  currency,
  error,
}: {
  products: CatalogProduct[];
  lines: ItemLine[];
  onChange: (lines: ItemLine[]) => void;
  currency: string;
  error?: string;
}) {
  const { t, f } = useI18n();
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const byId = React.useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => p.status !== "archived" && (!q || p.name.toLowerCase().includes(q))).slice(0, 30);
  }, [products, query]);

  function update(key: string, patch: Partial<ItemLine>) {
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-4" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={products.length ? t("Ajouter un produit du catalogue…") : t("Aucun produit au catalogue — ajoutez un article libre")}
          className="pl-8"
          disabled={!products.length}
          aria-label={t("Rechercher un produit")}
        />
        {open && filtered.length > 0 ? (
          <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border border-line bg-surface p-1 shadow-pop">
            {filtered.map((p) => {
              const out = p.track_stock && (p.stock ?? 0) <= 0;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={out}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange([...lines, lineFromProduct(p)]);
                      setQuery("");
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-sm px-2 py-1.5 text-left text-[13px] hover:bg-subtle disabled:opacity-50"
                  >
                    <Package className="size-4 text-ink-4" />
                    <span className="flex-1 truncate text-ink">{p.name}</span>
                    {p.status !== "active" ? <span className="text-xs text-ink-4">{t("masqué")}</span> : null}
                    {p.track_stock ? <span className={cn("text-xs tabular", out ? "text-danger-ink" : "text-ink-3")}>{out ? t("épuisé") : t("{n} en stock", { n: p.stock ?? 0 })}</span> : null}
                    <span className="font-medium tabular text-ink-2">{f.money(p.promo_price ?? p.price, currency)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      {lines.length === 0 ? (
        <div className={cn("rounded-md border border-dashed px-4 py-6 text-center text-[13px] text-ink-3", error ? "border-danger/50" : "border-line-strong")}>
          {t("Aucun article. Cherchez un produit ou ajoutez un article libre.")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-line">
          {lines.map((line) => {
            const product = line.product_id ? byId.get(line.product_id) : null;
            return (
              <div key={line.key} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 border-b border-line px-3 py-2.5 last:border-0 sm:grid-cols-[minmax(0,1fr)_120px_112px_100px_32px] sm:items-center">
                <div className="min-w-0">
                  {product ? (
                    <>
                      <p className="truncate text-[13.5px] font-medium text-ink">{product.name}</p>
                      {product.variants.length > 0 ? (
                        <NativeSelect
                          className="mt-1 h-8 text-[13px]"
                          value={line.variant_id ?? ""}
                          aria-label={t("Variante")}
                          onChange={(e) => {
                            const v = product.variants.find((x) => x.id === e.target.value);
                            update(line.key, { variant_id: v?.id ?? null, unit_price: v?.price ?? product.promo_price ?? product.price });
                          }}
                        >
                          {product.variants.map((v) => (
                            <option key={v.id} value={v.id} disabled={!v.available}>
                              {v.name}
                              {v.available ? "" : " (indisponible)"}
                            </option>
                          ))}
                        </NativeSelect>
                      ) : null}
                    </>
                  ) : (
                    <Input value={line.name} onChange={(e) => update(line.key, { name: e.target.value })} placeholder={t("Désignation de l'article")} className="h-8" aria-label={t("Désignation")} />
                  )}
                </div>
                <div className="row-start-2 flex items-center sm:row-start-auto">
                  <Button type="button" size="icon-sm" variant="secondary" aria-label={t("Diminuer")} onClick={() => update(line.key, { quantity: Math.max(1, line.quantity - 1) })}>
                    <Minus />
                  </Button>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={line.quantity}
                    onChange={(e) => update(line.key, { quantity: Math.max(1, Math.min(999, Number(e.target.value) || 1)) })}
                    className="h-7 w-11 bg-transparent text-center text-[13.5px] tabular outline-none"
                    aria-label={t("Quantité")}
                  />
                  <Button type="button" size="icon-sm" variant="secondary" aria-label={t("Augmenter")} onClick={() => update(line.key, { quantity: Math.min(999, line.quantity + 1) })}>
                    <Plus />
                  </Button>
                </div>
                <div className="row-start-2 sm:row-start-auto">
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      step={50}
                      value={line.unit_price}
                      onChange={(e) => update(line.key, { unit_price: Math.max(0, Number(e.target.value) || 0) })}
                      className="h-8 w-full rounded-md border border-line-strong px-2 pr-11 text-right text-[13px] tabular focus:border-accent focus:shadow-focus focus:outline-none"
                      aria-label={t("Prix unitaire")}
                    />
                    <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[11px] text-ink-4">FCFA</span>
                  </div>
                </div>
                <p className="col-start-2 row-start-1 text-right text-[13.5px] font-medium tabular sm:col-start-auto sm:row-start-auto">
                  {f.money(line.unit_price * line.quantity, currency)}
                </p>
                <Button type="button" size="icon-sm" variant="danger-ghost" aria-label={t("Retirer")} className="col-start-2 row-start-2 justify-self-end sm:col-start-auto sm:row-start-auto" onClick={() => onChange(lines.filter((l) => l.key !== line.key))}>
                  <Trash2 />
                </Button>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onChange([...lines, { key: newKey(), product_id: null, variant_id: null, name: "", unit_price: 0, quantity: 1 }])}
        >
          <Plus /> {t("Article libre")}
        </Button>
        {error ? <p className="text-xs text-danger-ink">{t(error)}</p> : null}
      </div>
    </div>
  );
}
