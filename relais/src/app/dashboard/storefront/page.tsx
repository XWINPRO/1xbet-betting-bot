import { requireStoreOwner, getSiteUrl } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { StorefrontForm, defaultHours } from "./storefront-form";
import type { OpeningHoursDay } from "@/types/domain";

export const metadata = { title: "Boutique en ligne" };

export default async function StorefrontPage() {
  const ctx = await requireStoreOwner();
  const supabase = await createSupabaseServerClient();
  const { data: s } = await supabase.from("stores").select("*").eq("id", ctx.storeId).single();
  const site = await getSiteUrl();
  if (!s) return null;
  const hours = (s.opening_hours as unknown as OpeningHoursDay[])?.length === 7 ? (s.opening_hours as unknown as OpeningHoursDay[]) : defaultHours();
  return (
    <PageContainer>
      <PageHeader title="Boutique en ligne" description="Votre page publique : identité, contact, horaires, conditions de livraison et paiement." />
      <StorefrontForm
        storeId={ctx.storeId}
        siteUrl={site}
        initial={{
          name: s.name,
          slug: s.slug,
          description: s.description ?? "",
          category: s.category ?? "",
          phone: s.phone ?? "",
          whatsapp: s.whatsapp ?? "",
          email: s.email ?? "",
          address: s.address ?? "",
          city: s.city ?? "",
          lat: s.lat,
          lng: s.lng,
          logo_path: s.logo_path,
          banner_path: s.banner_path,
          opening_hours: hours,
          delivery_terms: s.delivery_terms ?? "",
          default_delivery_fee: String(Number(s.default_delivery_fee)),
          accepted_payment_methods: s.accepted_payment_methods,
          is_published: s.is_published,
        }}
      />
    </PageContainer>
  );
}
