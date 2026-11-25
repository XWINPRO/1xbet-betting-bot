import { getI18n } from "@/i18n/server";
import type { Metadata } from "next";
import { requireStorePermission } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { param } from "@/lib/utils";
import { OrderForm } from "./order-form";
import type { ProductVariant } from "@/types/domain";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Nouvelle commande") };
}

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requireStorePermission("orders.create");
  const { t } = await getI18n();
  const supabase = await createSupabaseServerClient();
  const customerId = param(sp.customer);
  const [{ data: products }, { data: store }, customerRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, price, promo_price, status, track_stock, stock, variants")
      .eq("store_id", ctx.storeId)
      .neq("status", "archived")
      .order("name")
      .limit(1000),
    supabase.from("stores").select("default_delivery_fee, currency, accepted_payment_methods").eq("id", ctx.storeId).single(),
    customerId
      ? supabase.from("customers").select("id, full_name, phone, address, lat, lng").eq("id", customerId).eq("store_id", ctx.storeId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title={t("Nouvelle commande")}
        description={t("Saisissez une commande reçue par WhatsApp, téléphone ou en boutique.")}
        back={{ href: "/dashboard/orders", label: t("Commandes") }}
      />
      <OrderForm
        products={(products ?? []).map((p) => ({
          ...p,
          price: Number(p.price),
          promo_price: p.promo_price === null ? null : Number(p.promo_price),
          variants: (p.variants as unknown as ProductVariant[]) ?? [],
        }))}
        currency={store?.currency ?? "XAF"}
        defaultFee={Number(store?.default_delivery_fee ?? 0)}
        acceptedMethods={store?.accepted_payment_methods ?? ["cash_on_delivery"]}
        initialCustomer={customerRes.data ?? null}
      />
    </PageContainer>
  );
}
