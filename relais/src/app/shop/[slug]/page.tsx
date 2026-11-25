import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/auth";
import { publicAssetUrl } from "@/lib/storage";
import { Storefront } from "@/components/shop/storefront";
import type { OpeningHoursDay, ProductVariant } from "@/types/domain";
import { getI18n } from "@/i18n/server";

async function loadStore(slug: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("stores")
    .select("id, name, slug, description, category, phone, whatsapp, address, city, logo_path, banner_path, opening_hours, delivery_terms, default_delivery_fee, currency, accepted_payment_methods, is_published, status")
    .eq("slug", slug.toLowerCase())
    .eq("is_published", true)
    .eq("status", "active")
    .maybeSingle();
  return { supabase, store: data };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { store } = await loadStore(slug);
  const { t } = await getI18n();
  if (!store) return { title: t("Boutique introuvable") };
  const image = publicAssetUrl(store.banner_path ?? store.logo_path);
  return {
    title: store.name,
    description: store.description ?? t("Commandez en ligne chez {store}.", { store: store.name }),
    openGraph: { title: store.name, description: store.description ?? undefined, images: image ? [image] : undefined },
  };
}

export default async function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, store } = await loadStore(slug);
  if (!store) notFound();
  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, description, price, promo_price, images, category_id, track_stock, stock, variants")
      .eq("store_id", store.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("product_categories").select("id, name").eq("store_id", store.id).order("position"),
  ]);
  const site = await getSiteUrl();

  return (
    <Suspense>
      <Storefront
        shareBase={`${site}/shop/${store.slug}`}
        categories={categories ?? []}
        store={{
          name: store.name,
          slug: store.slug,
          description: store.description,
          category: store.category,
          phone: store.phone,
          whatsapp: store.whatsapp,
          address: store.address,
          city: store.city,
          logo_path: store.logo_path,
          banner_path: store.banner_path,
          opening_hours: (store.opening_hours as unknown as OpeningHoursDay[]) ?? [],
          delivery_terms: store.delivery_terms,
          default_delivery_fee: Number(store.default_delivery_fee),
          currency: store.currency,
          accepted_payment_methods: store.accepted_payment_methods,
        }}
        products={(products ?? []).map((p) => ({
          ...p,
          price: Number(p.price),
          promo_price: p.promo_price === null ? null : Number(p.promo_price),
          images: p.images ?? [],
          variants: (p.variants as unknown as ProductVariant[]) ?? [],
        }))}
      />
    </Suspense>
  );
}
