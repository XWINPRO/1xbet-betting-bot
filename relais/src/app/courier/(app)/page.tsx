import Link from "next/link";
import { Bike, Inbox } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCourierHome } from "@/lib/data/courier";
import { formatMoney } from "@/lib/format";
import { zonedStartOfDay } from "@/lib/period";
import { Notice, EmptyState } from "@/components/ui/page";
import { ActiveJobCard, AvailabilityToggle, OfferCard, OpenJobCard, type OpenJob } from "@/components/courier/home-widgets";

export default async function CourierHomePage() {
  const home = await getCourierHome();
  const c = home.courier;
  const supabase = await createSupabaseServerClient();
  const [{ data: openJobs }, { data: today }] = await Promise.all([
    c.kind === "platform" && c.account_status === "active" && c.availability === "available" ? supabase.rpc("courier_open_jobs") : Promise.resolve({ data: [] }),
    supabase
      .from("delivery_jobs")
      .select("id, collect_amount, cash_collected, price, currency, source")
      .eq("courier_id", c.id)
      .eq("status", "delivered")
      .gte("delivered_at", zonedStartOfDay(new Date()).toISOString()),
  ]);
  const deliveredToday = today?.length ?? 0;
  const cashToday = (today ?? []).filter((j) => j.cash_collected).reduce((s, j) => s + Number(j.collect_amount), 0);
  const currency = today?.[0]?.currency ?? "XAF";

  if (c.account_status === "pending_review") {
    return (
      <Notice tone="warning" title="Candidature en cours de validation">
        L&apos;équipe de la plateforme vérifie votre profil. Vous pourrez recevoir des courses dès sa validation.
      </Notice>
    );
  }
  if (c.account_status === "rejected") {
    return (
      <Notice tone="danger" title="Candidature refusée" action={<Link href="/courier/profile" className="text-[13px] font-medium underline">Mettre à jour</Link>}>
        {c.review_note ?? "Votre profil n'a pas été validé."} Vous pouvez corriger vos informations et soumettre à nouveau.
      </Notice>
    );
  }
  if (c.account_status === "suspended") {
    return (
      <Notice tone="danger" title="Compte suspendu">
        {c.review_note ?? "Votre compte livreur est suspendu. Contactez l'administration."}
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
    price: Number(j.price),
    currency: j.currency,
    storeName: j.stores?.name ?? null,
    source: j.source,
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
          <h2 className="mb-2 text-[13px] font-semibold text-ink-2">Course{home.active.length > 1 ? "s" : ""} en cours</h2>
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
          <p className="text-xs text-ink-3">Livrées aujourd&apos;hui</p>
          <p className="mt-1 text-xl font-semibold tabular">{deliveredToday}</p>
        </div>
        <div className="bg-surface px-4 py-3">
          <p className="text-xs text-ink-3">Espèces encaissées</p>
          <p className="mt-1 text-xl font-semibold tabular">{formatMoney(cashToday, currency)}</p>
        </div>
      </section>

      {c.kind === "platform" ? (
        <section>
          <h2 className="mb-2 text-[13px] font-semibold text-ink-2">Courses disponibles près de vous</h2>
          {c.availability !== "available" ? (
            <p className="rounded-lg border border-line bg-surface px-4 py-3 text-[13px] text-ink-3">Passez disponible pour voir les courses ponctuelles en attente.</p>
          ) : openJobs?.length ? (
            <div className="flex flex-col gap-3">
              {(openJobs as OpenJob[]).map((j) => (
                <OpenJobCard key={j.id} job={{ ...j, price: Number(j.price), distance_km: j.distance_km === null ? null : Number(j.distance_km) }} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-line bg-surface">
              <EmptyState compact icon={<Inbox />} title="Aucune course en attente" description="Les nouvelles demandes apparaissent ici automatiquement." />
            </div>
          )}
        </section>
      ) : !home.offers.length && !home.active.length ? (
        <div className="rounded-lg border border-line bg-surface">
          <EmptyState compact icon={<Bike />} title="Aucune course pour le moment" description="Les courses que vos boutiques vous attribuent apparaîtront ici, avec une notification." />
        </div>
      ) : null}
    </div>
  );
}
