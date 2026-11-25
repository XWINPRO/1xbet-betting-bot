import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { PricingEditor } from "@/components/admin/pricing-editor";

export const metadata = { title: "Tarification" };

export default async function AdminPricingPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data: rules } = await supabase.from("pricing_rules").select("*").order("is_active", { ascending: false }).order("created_at");
  return (
    <PageContainer size="narrow">
      <PageHeader
        title="Tarification des livraisons ponctuelles"
        description="Prix = max(minimum, prise en charge + prix au km × distance) + supplément colis, arrondi au palier supérieur. Le prix est recalculé par le serveur à chaque demande."
      />
      <div className="flex flex-col gap-6">
        {(rules ?? []).map((r) => (
          <PricingEditor
            key={r.id}
            rule={{
              id: r.id,
              name: r.name,
              base_fee: Number(r.base_fee),
              per_km_fee: Number(r.per_km_fee),
              min_fee: Number(r.min_fee),
              max_distance_km: r.max_distance_km === null ? null : Number(r.max_distance_km),
              rounding: r.rounding,
              surcharges: (r.package_surcharges as Record<string, number>) ?? {},
              is_active: r.is_active,
            }}
          />
        ))}
        <PricingEditor rule={{ id: null, name: "", base_fee: 500, per_km_fee: 150, min_fee: 1000, max_distance_km: 40, rounding: 100, surcharges: {}, is_active: false }} />
      </div>
    </PageContainer>
  );
}
