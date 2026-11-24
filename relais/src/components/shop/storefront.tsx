"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Clock, ImageOff, LocateFixed, MapPin, MessageCircle, Minus, Phone, Plus, Search, Share2, ShoppingBag, Trash2, X } from "lucide-react";
import { placeStorefrontOrderAction } from "@/lib/actions/public";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Notice } from "@/components/ui/page";
import { formatMoney } from "@/lib/format";
import { telHref } from "@/lib/phone";
import { publicAssetUrl } from "@/lib/storage";
import { whatsappShareUrl, whatsappUrl, waMessages } from "@/lib/whatsapp";
import { PAYMENT_METHODS } from "@/lib/payments";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
import type { OpeningHoursDay, PaymentMethod, ProductVariant } from "@/types/domain";

export type ShopProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  promo_price: number | null;
  images: string[];
  category_id: string | null;
  track_stock: boolean;
  stock: number | null;
  variants: ProductVariant[];
};

export type ShopStore = {
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  city: string | null;
  logo_path: string | null;
  banner_path: string | null;
  opening_hours: OpeningHoursDay[];
  delivery_terms: string | null;
  default_delivery_fee: number;
  currency: string;
  accepted_payment_methods: PaymentMethod[];
};

type CartLine = { key: string; product_id: string; variant_id: string | null; quantity: number };

const DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

function openState(hours: OpeningHoursDay[]) {
  if (hours.length !== 7) return null;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: env.timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const idx = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(wd);
  const time = `${parts.find((p) => p.type === "hour")?.value}:${parts.find((p) => p.type === "minute")?.value}`;
  const today = hours.find((h) => h.day === idx + 1);
  if (!today) return null;
  const open = !today.closed && time >= today.open && time < today.close;
  return { open, today, label: open ? `Ouvert · ferme à ${today.close}` : today.closed ? "Fermé aujourd'hui" : time < today.open ? `Fermé · ouvre à ${today.open}` : "Fermé" };
}

function unitPrice(p: ShopProduct, variantId: string | null) {
  const v = variantId ? p.variants.find((x) => x.id === variantId) : null;
  return v?.price ?? p.promo_price ?? p.price;
}

function useCart(slug: string) {
  const key = `relais-cart:${slug}`;
  const [lines, setLines] = React.useState<CartLine[]>([]);
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setLines(JSON.parse(raw) as CartLine[]);
    } catch {
      /* stockage indisponible */
    }
    setReady(true);
  }, [key]);
  React.useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(key, JSON.stringify(lines));
    } catch {
      /* stockage indisponible */
    }
  }, [key, lines, ready]);
  return [lines, setLines] as const;
}

export function Storefront({ store, products, categories, shareBase }: { store: ShopStore; products: ShopProduct[]; categories: { id: string; name: string }[]; shareBase: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<string | null>(null);
  const [cart, setCart] = useCart(store.slug);
  const [cartOpen, setCartOpen] = React.useState(false);
  const [status, setStatus] = React.useState<ReturnType<typeof openState>>(null);
  const byId = React.useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const selectedId = searchParams.get("p");
  const selected = selectedId ? byId.get(selectedId) ?? null : null;

  React.useEffect(() => setStatus(openState(store.opening_hours)), [store.opening_hours]);

  const visible = products.filter((p) => (!category || p.category_id === category) && (!query.trim() || p.name.toLowerCase().includes(query.trim().toLowerCase())));
  const usedCategories = categories.filter((c) => products.some((p) => p.category_id === c.id));
  const validCart = cart.filter((l) => byId.has(l.product_id));
  const count = validCart.reduce((s, l) => s + l.quantity, 0);
  const subtotal = validCart.reduce((s, l) => s + unitPrice(byId.get(l.product_id)!, l.variant_id) * l.quantity, 0);

  function openProduct(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("p", id);
    else params.delete("p");
    router.replace(`${pathname}${params.size ? `?${params.toString()}` : ""}`, { scroll: false });
  }

  function addToCart(productId: string, variantId: string | null, quantity: number) {
    setCart((lines) => {
      const key = `${productId}:${variantId ?? ""}`;
      const existing = lines.find((l) => l.key === key);
      if (existing) return lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(99, l.quantity + quantity) } : l));
      return [...lines, { key, product_id: productId, variant_id: variantId, quantity }];
    });
    toast.success("Ajouté au panier.");
  }

  const banner = publicAssetUrl(store.banner_path);
  const logo = publicAssetUrl(store.logo_path);
  const contactPhone = store.whatsapp ?? store.phone;

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <header className="bg-surface">
        {banner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={banner} alt="" className="h-36 w-full object-cover sm:h-52" />
        ) : (
          <div className="h-16 border-b border-line bg-subtle sm:h-20" />
        )}
        <div className="mx-auto max-w-5xl px-4">
          <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <div className={cn("-mt-8 flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border-4 border-surface bg-surface shadow-sm sm:-mt-10 sm:size-24")}>
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt={store.name} className="size-full object-cover" />
                ) : (
                  <span className="text-2xl font-semibold text-ink-3">{store.name.slice(0, 1)}</span>
                )}
              </div>
              <div className="min-w-0 pb-1">
                <h1 className="text-xl font-semibold tracking-[-0.01em]">{store.name}</h1>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-ink-3">
                  {store.category ? <span>{store.category}</span> : null}
                  {store.city || store.address ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {[store.address, store.city].filter(Boolean).join(", ")}
                    </span>
                  ) : null}
                  {status ? (
                    <span className={cn("inline-flex items-center gap-1", status.open ? "text-success" : "text-ink-3")}>
                      <Clock className="size-3.5" />
                      {status.label}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {contactPhone ? (
                <Button asChild variant="whatsapp">
                  <a href={whatsappUrl(contactPhone, `Bonjour ${store.name}, `) ?? "#"} target="_blank" rel="noopener noreferrer">
                    <MessageCircle /> WhatsApp
                  </a>
                </Button>
              ) : null}
              {store.phone ? (
                <Button asChild variant="secondary">
                  <a href={telHref(store.phone) ?? "#"}>
                    <Phone /> Appeler
                  </a>
                </Button>
              ) : null}
              <Button asChild variant="ghost" aria-label="Partager la boutique">
                <a href={whatsappShareUrl(`${store.name} — commandez en ligne : ${shareBase}`)} target="_blank" rel="noopener noreferrer">
                  <Share2 />
                </a>
              </Button>
            </div>
          </div>
          {store.description ? <p className="max-w-3xl py-4 text-[14px] leading-relaxed text-ink-2">{store.description}</p> : null}
        </div>
      </header>

      <div className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center">
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-4" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un produit" className="pl-8" aria-label="Rechercher un produit" />
          </div>
          {usedCategories.length ? (
            <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
              {[{ id: null as string | null, name: "Tout" }, ...usedCategories].map((c) => (
                <button
                  key={c.id ?? "all"}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={cn("h-8 shrink-0 rounded-full border px-3 text-[13px] font-medium", category === c.id ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink-2 hover:bg-subtle")}
                >
                  {c.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-5">
        {visible.length === 0 ? (
          <div className="rounded-lg border border-line bg-surface px-6 py-12 text-center">
            <p className="text-[14px] font-medium">{products.length ? "Aucun produit ne correspond" : "Catalogue en préparation"}</p>
            <p className="mt-1 text-[13px] text-ink-3">{products.length ? "Essayez une autre recherche." : "Contactez la boutique sur WhatsApp pour commander."}</p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((p) => {
              const img = publicAssetUrl(p.images[0]);
              const out = p.track_stock && (p.stock ?? 0) <= 0;
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => openProduct(p.id)} className="group flex w-full flex-col overflow-hidden rounded-lg border border-line bg-surface text-left transition-shadow hover:shadow-sm">
                    <div className="relative aspect-square w-full bg-subtle">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={p.name} loading="lazy" className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center">
                          <ImageOff className="size-6 text-ink-4" />
                        </div>
                      )}
                      {out ? <span className="absolute top-2 left-2 rounded-xs bg-ink/85 px-1.5 py-0.5 text-[11px] font-medium text-white">Épuisé</span> : null}
                      {!out && p.promo_price !== null ? <span className="absolute top-2 left-2 rounded-xs bg-danger px-1.5 py-0.5 text-[11px] font-medium text-white">Promo</span> : null}
                    </div>
                    <div className="flex flex-1 flex-col p-3">
                      <p className="line-clamp-2 text-[13.5px] font-medium text-ink">{p.name}</p>
                      <p className="mt-1 text-[14px] font-semibold tabular">
                        {formatMoney(p.promo_price ?? p.price, store.currency)}
                        {p.promo_price !== null ? <span className="ml-1.5 text-xs font-normal text-ink-4 line-through">{formatMoney(p.price, store.currency)}</span> : null}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {store.delivery_terms || store.default_delivery_fee > 0 ? (
          <section className="mt-8 rounded-lg border border-line bg-surface p-5 text-[13.5px]">
            <h2 className="font-semibold">Livraison</h2>
            {store.default_delivery_fee > 0 ? <p className="mt-1 text-ink-2">Frais de livraison : {formatMoney(store.default_delivery_fee, store.currency)}</p> : null}
            {store.delivery_terms ? <p className="mt-1 whitespace-pre-line text-ink-3">{store.delivery_terms}</p> : null}
          </section>
        ) : null}
        {store.opening_hours.length === 7 ? (
          <section className="mt-4 rounded-lg border border-line bg-surface p-5 text-[13.5px]">
            <h2 className="font-semibold">Horaires</h2>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {store.opening_hours.map((h) => (
                <li key={h.day} className="flex justify-between gap-4 text-ink-2">
                  <span className="capitalize">{DAYS[h.day - 1]}</span>
                  <span className="tabular text-ink-3">{h.closed ? "Fermé" : `${h.open} – ${h.close}`}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <p className="mt-8 text-center text-xs text-ink-4">Boutique propulsée par {env.appName}</p>
      </main>

      {count > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 p-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur-sm">
          <div className="mx-auto max-w-5xl">
            <Button size="lg" variant="primary" block onClick={() => setCartOpen(true)}>
              <ShoppingBag /> Voir le panier · {count} article{count > 1 ? "s" : ""} · {formatMoney(subtotal, store.currency)}
            </Button>
          </div>
        </div>
      ) : null}

      <ProductDialog product={selected} store={store} shareBase={shareBase} onClose={() => openProduct(null)} onAdd={addToCart} />
      <CartDialog open={cartOpen} onOpenChange={setCartOpen} store={store} cart={validCart} setCart={setCart} byId={byId} subtotal={subtotal} />
    </div>
  );
}

function ProductDialog({
  product,
  store,
  shareBase,
  onClose,
  onAdd,
}: {
  product: ShopProduct | null;
  store: ShopStore;
  shareBase: string;
  onClose: () => void;
  onAdd: (productId: string, variantId: string | null, qty: number) => void;
}) {
  const [variant, setVariant] = React.useState<string | null>(null);
  const [qty, setQty] = React.useState(1);
  const [imgIndex, setImgIndex] = React.useState(0);
  React.useEffect(() => {
    setVariant(product?.variants.find((v) => v.available)?.id ?? null);
    setQty(1);
    setImgIndex(0);
  }, [product]);
  if (!product) return null;
  const out = product.track_stock && (product.stock ?? 0) <= 0;
  const price = unitPrice(product, variant);
  const url = `${shareBase}?p=${product.id}`;
  const img = publicAssetUrl(product.images[imgIndex]);
  const maxQty = product.track_stock ? Math.max(1, Math.min(99, product.stock ?? 0)) : 99;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={product.name} size="lg">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <div className="aspect-square overflow-hidden rounded-md border border-line bg-subtle">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt={product.name} className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center">
                  <ImageOff className="size-8 text-ink-4" />
                </div>
              )}
            </div>
            {product.images.length > 1 ? (
              <div className="mt-2 flex gap-2 overflow-x-auto">
                {product.images.map((path, i) => (
                  <button key={path} type="button" onClick={() => setImgIndex(i)} className={cn("size-14 shrink-0 overflow-hidden rounded-sm border-2", i === imgIndex ? "border-ink" : "border-transparent")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={publicAssetUrl(path)!} alt="" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex flex-col gap-4">
            <p className="text-xl font-semibold tabular">
              {formatMoney(price, store.currency)}
              {product.promo_price !== null && !variant ? <span className="ml-2 text-sm font-normal text-ink-4 line-through">{formatMoney(product.price, store.currency)}</span> : null}
            </p>
            {product.description ? <p className="text-[14px] leading-relaxed whitespace-pre-line text-ink-2">{product.description}</p> : null}
            {product.variants.length ? (
              <Field label="Choix" htmlFor="variant">
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      disabled={!v.available}
                      onClick={() => setVariant(v.id)}
                      className={cn(
                        "h-9 rounded-md border px-3 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through",
                        variant === v.id ? "border-ink bg-ink text-white" : "border-line-strong hover:bg-subtle",
                      )}
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
              </Field>
            ) : null}
            {product.track_stock && !out ? <p className="text-xs text-ink-3">{product.stock} en stock</p> : null}
            {out ? (
              <Notice tone="neutral">Produit épuisé pour le moment.</Notice>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-md border border-line-strong">
                  <button type="button" className="flex size-10 items-center justify-center text-ink-2" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Moins">
                    <Minus className="size-4" />
                  </button>
                  <span className="w-8 text-center tabular">{qty}</span>
                  <button type="button" className="flex size-10 items-center justify-center text-ink-2" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} aria-label="Plus">
                    <Plus className="size-4" />
                  </button>
                </div>
                <Button
                  size="lg"
                  variant="primary"
                  className="flex-1"
                  disabled={product.variants.length > 0 && !variant}
                  onClick={() => {
                    onAdd(product.id, variant, qty);
                    onClose();
                  }}
                >
                  Ajouter · {formatMoney(price * qty, store.currency)}
                </Button>
              </div>
            )}
            <Button asChild variant="whatsapp" size="sm" className="self-start">
              <a href={whatsappShareUrl(waMessages.productShare({ storeName: store.name, productName: product.name, price, currency: store.currency, url }))} target="_blank" rel="noopener noreferrer">
                <Share2 /> Partager sur WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CartDialog({
  open,
  onOpenChange,
  store,
  cart,
  setCart,
  byId,
  subtotal,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  store: ShopStore;
  cart: CartLine[];
  setCart: React.Dispatch<React.SetStateAction<CartLine[]>>;
  byId: Map<string, ShopProduct>;
  subtotal: number;
}) {
  const [step, setStep] = React.useState<"cart" | "checkout" | "done">("cart");
  const [form, setForm] = React.useState({ name: "", phone: "", address: "", instructions: "" });
  const [mode, setMode] = React.useState<"delivery" | "pickup">("delivery");
  const [point, setPoint] = React.useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = React.useState(false);
  const [method, setMethod] = React.useState<PaymentMethod>(store.accepted_payment_methods[0] ?? "cash_on_delivery");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<{ reference: string; total: number; lines: { name: string; quantity: number; variant: string | null; total: number }[] } | null>(null);
  const fee = mode === "delivery" ? store.default_delivery_fee : 0;
  const total = subtotal + fee;
  const methods = PAYMENT_METHODS.filter((m) => store.accepted_payment_methods.includes(m.method));

  React.useEffect(() => {
    if (open && step === "done") return;
    if (open) setStep("cart");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function linesSummary() {
    return cart.map((l) => {
      const p = byId.get(l.product_id)!;
      const v = l.variant_id ? p.variants.find((x) => x.id === l.variant_id) : null;
      return { name: p.name, quantity: l.quantity, variant: v?.name ?? null, total: unitPrice(p, l.variant_id) * l.quantity };
    });
  }

  async function submit() {
    setPending(true);
    setError(null);
    const lines = linesSummary();
    const res = await placeStorefrontOrderAction(store.slug, {
      customer: { name: form.name, phone: form.phone, address: form.address, lat: point?.lat ?? null, lng: point?.lng ?? null },
      items: cart.map((l) => ({ product_id: l.product_id, variant_id: l.variant_id, quantity: l.quantity })),
      delivery_mode: mode,
      payment_method: method,
      instructions: form.instructions,
    });
    setPending(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      setError(res.error);
      return;
    }
    setResult({ reference: res.data.reference, total: res.data.total, lines });
    setCart([]);
    setStep("done");
  }

  const contact = store.whatsapp ?? store.phone;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={step === "cart" ? "Votre panier" : step === "checkout" ? "Finaliser la commande" : "Commande envoyée"}
        size="md"
        footer={
          step === "cart" ? (
            <Button size="lg" variant="primary" block disabled={!cart.length} onClick={() => setStep("checkout")}>
              Commander · {formatMoney(subtotal, store.currency)}
            </Button>
          ) : step === "checkout" ? (
            <div className="flex w-full gap-2">
              <Button variant="ghost" onClick={() => setStep("cart")}>
                Retour
              </Button>
              <Button size="lg" variant="primary" className="flex-1" loading={pending} onClick={submit}>
                Envoyer la commande · {formatMoney(total, store.currency)}
              </Button>
            </div>
          ) : (
            <Button variant="secondary" block onClick={() => onOpenChange(false)}>
              Continuer mes achats
            </Button>
          )
        }
      >
        {step === "cart" ? (
          cart.length === 0 ? (
            <p className="py-6 text-center text-[13.5px] text-ink-3">Votre panier est vide.</p>
          ) : (
            <ul className="divide-y divide-line">
              {cart.map((l) => {
                const p = byId.get(l.product_id)!;
                const v = l.variant_id ? p.variants.find((x) => x.id === l.variant_id) : null;
                const img = publicAssetUrl(p.images[0]);
                return (
                  <li key={l.key} className="flex items-center gap-3 py-3">
                    <div className="size-12 shrink-0 overflow-hidden rounded-md border border-line bg-subtle">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {img ? <img src={img} alt="" className="size-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium">{p.name}</p>
                      {v ? <p className="text-xs text-ink-3">{v.name}</p> : null}
                      <p className="text-[13px] tabular">{formatMoney(unitPrice(p, l.variant_id) * l.quantity, store.currency)}</p>
                    </div>
                    <div className="flex items-center rounded-md border border-line-strong">
                      <button type="button" className="flex size-8 items-center justify-center" aria-label="Moins" onClick={() => setCart((c) => c.map((x) => (x.key === l.key ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x)))}>
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-6 text-center text-[13px] tabular">{l.quantity}</span>
                      <button type="button" className="flex size-8 items-center justify-center" aria-label="Plus" onClick={() => setCart((c) => c.map((x) => (x.key === l.key ? { ...x, quantity: Math.min(99, x.quantity + 1) } : x)))}>
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <button type="button" className="p-1 text-ink-4 hover:text-danger-ink" aria-label="Retirer" onClick={() => setCart((c) => c.filter((x) => x.key !== l.key))}>
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : step === "checkout" ? (
          <div className="flex flex-col gap-4">
            {error ? <Notice tone="danger">{error}</Notice> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Votre nom" htmlFor="co-name" error={errors.name}>
                <Input id="co-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
              </Field>
              <Field label="Téléphone (WhatsApp)" htmlFor="co-phone" error={errors.phone}>
                <Input id="co-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["delivery", "pickup"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)} className={cn("rounded-md border px-3 py-2.5 text-left text-[13px]", mode === m ? "border-ink shadow-[inset_0_0_0_1px_var(--color-ink)]" : "border-line-strong")}>
                  <span className="block font-medium">{m === "delivery" ? "Livraison" : "Retrait en boutique"}</span>
                  <span className="text-xs text-ink-3">{m === "delivery" ? (store.default_delivery_fee ? formatMoney(store.default_delivery_fee, store.currency) : "Frais confirmés par la boutique") : "Gratuit"}</span>
                </button>
              ))}
            </div>
            {mode === "delivery" ? (
              <>
                <Field label="Adresse de livraison" htmlFor="co-address" error={errors.address} hint="Quartier, rue, repère.">
                  <Input id="co-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} autoComplete="street-address" />
                </Field>
                <div className="flex items-center gap-2 text-[13px]">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    loading={locating}
                    onClick={() => {
                      if (!("geolocation" in navigator)) return toast.error("Localisation indisponible.");
                      setLocating(true);
                      navigator.geolocation.getCurrentPosition(
                        (p) => {
                          setLocating(false);
                          setPoint({ lat: p.coords.latitude, lng: p.coords.longitude });
                        },
                        () => {
                          setLocating(false);
                          toast.error("Position non obtenue. L'adresse suffit.");
                        },
                        { enableHighAccuracy: true, timeout: 15000 },
                      );
                    }}
                  >
                    <LocateFixed /> {point ? "Position enregistrée" : "Partager ma position"}
                  </Button>
                  {point ? (
                    <button type="button" className="text-ink-3 hover:text-ink" onClick={() => setPoint(null)} aria-label="Retirer la position">
                      <X className="size-4" />
                    </button>
                  ) : (
                    <span className="text-xs text-ink-3">Facultatif, aide le livreur.</span>
                  )}
                </div>
              </>
            ) : null}
            <Field label="Paiement" htmlFor="co-pay">
              <NativeSelect id="co-pay" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {methods.map((m) => (
                  <option key={m.method} value={m.method}>
                    {m.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <p className="-mt-2 text-xs text-ink-3">{methods.find((m) => m.method === method)?.description}</p>
            <Field label="Précisions" htmlFor="co-instr" optional>
              <Textarea id="co-instr" rows={2} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
            </Field>
            <dl className="space-y-1 border-t border-line pt-3 text-[13.5px]">
              <div className="flex justify-between">
                <dt className="text-ink-3">Articles</dt>
                <dd className="tabular">{formatMoney(subtotal, store.currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-3">Livraison</dt>
                <dd className="tabular">{formatMoney(fee, store.currency)}</dd>
              </div>
              <div className="flex justify-between text-[15px] font-semibold">
                <dt>Total</dt>
                <dd className="tabular">{formatMoney(total, store.currency)}</dd>
              </div>
            </dl>
          </div>
        ) : result ? (
          <div className="flex flex-col items-start gap-3">
            <CheckCircle2 className="size-8 text-success" />
            <p className="text-[15px] font-semibold">Commande {result.reference} reçue</p>
            <p className="text-[13.5px] text-ink-2">
              {store.name} va confirmer votre commande. Total : <span className="font-medium tabular">{formatMoney(result.total, store.currency)}</span>.
            </p>
            {contact ? (
              <>
                <p className="text-[13px] text-ink-3">Pour accélérer la confirmation, envoyez le récapitulatif à la boutique sur WhatsApp :</p>
                <Button asChild variant="whatsapp">
                  <a
                    href={whatsappUrl(contact, waMessages.storefrontOrder({ storeName: store.name, reference: result.reference, customerName: form.name, items: result.lines, total: result.total, currency: store.currency, mode, address: form.address })) ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle /> Envoyer sur WhatsApp
                  </a>
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
