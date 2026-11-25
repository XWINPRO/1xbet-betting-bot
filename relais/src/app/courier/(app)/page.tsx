import { Bike } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCourierHome } from "@/lib/data/courier";
import { zonedStartOfDay } from "@/lib/period";
import { Notice, EmptyState } from "@/components/ui/page";
import { ActiveJobCard, AvailabilityToggle, OfferCard } from "@/components/courier/home-widgets";
import { getI18n } from "@/i18n/server";

export default async function CourierHomePage() {
  const home = await getCourierHome();
  const { t, tn, f } = await getI18n();
  const c = home.courier;
  const supabase = await createSupabaseServerClient();
  const { data: today } = await supabase
    .from("delivery_jobs")
    .select("id, collect_amount, cash_collected, currency")
    .eq("courier_id", c.id)
    .eq("status", "delivered")
    .gte("delivered_at", zonedStartOfDay(new Date()).toISOString());
  const deliveredToday = today?.length ?? 0;
  const cashToday = (today ?? []).filter((j) => j.cash_collected).reduce((s, j) => s + Number(j.collect_amount), 0);
  const currency = today?.[0]?.currency ?? "XAF";

  if (c.account_status === "suspended") {
    return (
      <Notice tone="danger" title={t("Compte suspendu")}>
        {c.review_note ?? t("Votre compte livreur est suspendu. Contactez votre commerçant.")}
      </Notice>
    );
  }

  const map = (j: (typeof home.active)[number]) => ({
    id: j.id,
    reference: j.reference,
    status: j.status,
    pickup_name: j.pickup_name,
    pickup_address: j.pickup_address,
    dropoff_address: j.dropoff_address,
    dropoff_name: j.dropoff_name,
    collect_amount: Number(j.collect_amount),
    currency: j.currency,
    storeName: j.stores?.name ?? null,
  });

  return (
    <div className="flex flex-col gap-5">
      {home.offers.length ? (
        <section className="flex flex-col gap-3">
          {home.offers.map((j) => (
            <OfferCard key={j.id} job={map(j)} />
          ))}
        </section>
      ) : null}

      {home.active.length ? (
        <section>
          <h2 className="mb-2 text-[13px] font-semibold text-ink-2">{tn(home.active.length, "Course en cours", "Courses en cours")}</h2>
          <div className="flex flex-col gap-3">
            {home.active.map((j) => (
              <ActiveJobCard key={j.id} job={map(j)} />
            ))}
          </div>
        </section>
      ) : null}

      <AvailabilityToggle available={c.availability === "available"} activeJobs={home.active.length} />

      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
        <div className="bg-surface px-4 py-3">
          <p className="text-xs text-ink-3">{t("Livrées aujourd'hui")}</p>
          <p className="mt-1 text-xl font-semibold tabular">{deliveredToday}</p>
        </div>
        <div className="bg-surface px-4 py-3">
          <p className="text-xs text-ink-3">{t("Espèces encaissées")}</p>
          <p className="mt-1 text-xl font-semibold tabular">{f.money(cashToday, currency)}</p>
        </div>
      </section>

      {!home.offers.length && !home.active.length ? (
        <div className="rounded-lg border border-line bg-surface">
          <EmptyState
            compact
            icon={<Bike />}
            title={t("Aucune course pour le moment")}
            description={t("Les courses que vos boutiques vous attribuent apparaîtront ici, avec une notification.")}
          />
        </div>
      ) : null}
    </div>
  );
}
