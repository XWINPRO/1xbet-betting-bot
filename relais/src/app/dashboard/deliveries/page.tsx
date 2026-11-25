import { getI18n } from "@/i18n/server";
import type { Metadata } from "next";
import Link from "next/link";
import { Truck } from "lucide-react";
import { getStoreContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { secondsSince } from "@/lib/format";
import { msg } from "@/i18n/msg";
import { getStorePlan } from "@/lib/data/plan";
import { Notice } from "@/components/ui/page";
import type { BoardCourier } from "@/types/domain";
import { JOB_STATUS } from "@/lib/status";
import { pageNumber, sanitizeSearch } from "@/lib/search";
import { toLatLng } from "@/lib/geo";
import { param } from "@/lib/utils";
import { EmptyState, PageContainer, PageHeader } from "@/components/ui/page";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { RelativeTime, SearchInput } from "@/components/ui/client-helpers";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { RealtimeRefresher } from "@/components/realtime/realtime-refresher";
import { DeliveriesMap } from "@/components/delivery/deliveries-map";
import type { JobStatus } from "@/types/domain";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Livraisons") };
}
const PAGE_SIZE = 30;

const TABS: { key: string; label: string; statuses: JobStatus[] | null }[] = [
  { key: "active", label: msg("En cours"), statuses: ["pending", "offered", "accepted", "picked_up", "in_transit"] },
  { key: "unassigned", label: msg("Sans livreur"), statuses: ["pending"] },
  { key: "delivered", label: msg("Livrées"), statuses: ["delivered"] },
  { key: "issues", label: msg("Échecs et annulations"), statuses: ["failed", "cancelled"] },
  { key: "all", label: msg("Toutes"), statuses: null },
];

export default async function DeliveriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ctx = await getStoreContext();
  const { t, tn, f } = await getI18n();
  const plan = await getStorePlan(ctx.storeId);
  const liveTracking = plan.tracking === "live";
  const supabase = await createSupabaseServerClient();
  const tab = TABS.find((x) => x.key === param(sp.tab)) ?? TABS[0];
  const q = sanitizeSearch(param(sp.q));
  const page = pageNumber(param(sp.page));

  let query = supabase
    .from("delivery_jobs")
    .select(
      "id, reference, status, dropoff_name, dropoff_address, dropoff_lat, dropoff_lng, collect_amount, currency, updated_at, created_at, courier_id, couriers(full_name), orders!delivery_jobs_order_id_fkey(id, reference)",
      { count: "exact" },
    )
    .eq("store_id", ctx.storeId)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (tab.statuses) query = query.in("status", tab.statuses);
  if (q) query = query.or(`reference.ilike.%${q}%,dropoff_name.ilike.%${q}%,dropoff_address.ilike.%${q}%`);

  const [{ data: jobs, count, error }, { data: store }, { data: stale }, { data: board }] = await Promise.all([
    query,
    supabase.from("stores").select("lat, lng").eq("id", ctx.storeId).single(),
    supabase.from("platform_settings").select("value").eq("key", "location.stale_after_s").maybeSingle(),
    // Positions : uniquement via le tableau des livreurs, qui applique le plan.
    liveTracking && ctx.can("couriers.assign") ? supabase.rpc("store_courier_board", { p_store_id: ctx.storeId }) : Promise.resolve({ data: [] as BoardCourier[] }),
  ]);
  const positions = new Map(((board ?? []) as BoardCourier[]).filter((c) => c.last_lat != null && c.last_lng != null).map((c) => [c.courier_id, c]));
  if (error) throw error;
  const staleAfter = Number(stale?.value ?? 120);
  const list = jobs ?? [];
  const live = list.filter((j) => ["accepted", "picked_up", "in_transit"].includes(j.status));
  const mapCouriers = live
    .filter((j) => j.courier_id && positions.has(j.courier_id))
    .map((j) => {
      const c = positions.get(j.courier_id!)!;
      return {
        id: j.id,
        lat: c.last_lat,
        lng: c.last_lng,
        accuracy: c.last_accuracy,
        label: `${c.full_name} · ${j.reference}`,
        status: "busy" as const,
        stale: (secondsSince(c.last_location_at) ?? Infinity) > staleAfter,
      };
    });
  const dropoffs = list
    .filter((j) => !["delivered", "failed", "cancelled"].includes(j.status) && j.dropoff_lat != null && j.dropoff_lng != null)
    .map((j) => ({ id: `d-${j.id}`, lat: j.dropoff_lat!, lng: j.dropoff_lng!, label: `${j.reference} · ${j.dropoff_name}` }));

  return (
    <PageContainer size="wide">
      <RealtimeRefresher channel={`deliveries-${ctx.storeId}`} tables={["delivery_jobs"]} filter={`store_id=eq.${ctx.storeId}`} />
      <RealtimeRefresher channel={`deliveries-couriers-${ctx.storeId}`} tables={["couriers"]} debounceMs={3000} />
      <PageHeader title={t("Livraisons")} description={t("Suivi opérationnel des courses de votre boutique. Créez une course depuis la fiche d'une commande.")} />
      {tab.key === "active" && !liveTracking ? (
        <Notice tone="neutral" className="mb-6" title={t("Carte des livreurs")}>
          {plan.max_couriers === 0
            ? t("Votre plan actuel ne comprend pas de livreurs. Choisissez un plan dans Abonnement pour livrer vos commandes.")
            : t("Votre plan suit les livraisons par étapes. La carte avec la position GPS des livreurs est incluse dans les plans Pro et Entreprise.")}
        </Notice>
      ) : null}
      {tab.key === "active" && liveTracking ? (
        <Panel className="mb-6 overflow-hidden">
          <PanelHeader
            title={t("Carte des courses actives")}
            description={`${tn(live.length, "{n} course en route", "{n} courses en route")} · ${tn(dropoffs.length, "{n} destination", "{n} destinations")} · ${t("positions réelles transmises par les téléphones des livreurs")}`}
          />
          <DeliveriesMap store={toLatLng(store?.lat, store?.lng)} couriers={mapCouriers} dropoffs={dropoffs} />
        </Panel>
      ) : null}
      <Panel>
        <div className="flex flex-col gap-3 border-b border-line px-5 pt-2 lg:flex-row lg:items-end lg:justify-between">
          <FilterTabs active={tab.key} items={TABS.map((x) => ({ key: x.key, label: t(x.label), href: `/dashboard/deliveries?tab=${x.key}${q ? `&q=${encodeURIComponent(q)}` : ""}` }))} />
          <div className="pb-2.5">
            <SearchInput placeholder={t("Référence, destinataire, adresse")} />
          </div>
        </div>
        {!list.length ? (
          <EmptyState icon={<Truck />} title={t("Aucune course")} description={tab.key === "active" ? t("Aucune livraison en cours. Ouvrez une commande prête pour créer une course.") : t("Aucune course dans cette catégorie.")} />
        ) : (
          <>
            <TableWrap>
              <Table>
                <THead>
                  <tr>
                    <TH>{t("Course")}</TH>
                    <TH>{t("Destinataire")}</TH>
                    <TH>{t("Livreur")}</TH>
                    <TH>{t("Statut")}</TH>
                    <TH className="hidden lg:table-cell">{t("Mise à jour")}</TH>
                    <TH align="right" className="hidden md:table-cell">{t("À encaisser")}</TH>
                  </tr>
                </THead>
                <tbody>
                  {list.map((j) => (
                    <TR key={j.id}>
                      <TD>
                        {j.orders ? (
                          <Link href={`/dashboard/orders/${j.orders.id}`} className="font-medium text-ink hover:text-accent">
                            {j.orders.reference}
                          </Link>
                        ) : null}
                        <div className="font-mono text-xs text-ink-3">{j.reference}</div>
                      </TD>
                      <TD>
                        <div className="max-w-[220px] truncate">{j.dropoff_name}</div>
                        <div className="max-w-[260px] truncate text-xs text-ink-3">{j.dropoff_address}</div>
                      </TD>
                      <TD>{j.couriers?.full_name ?? <span className="text-warning-ink">{t("À attribuer")}</span>}</TD>
                      <TD>
                        <StatusBadge map={JOB_STATUS} value={j.status} pulse={j.status === "in_transit"} />
                      </TD>
                      <TD className="hidden text-ink-3 lg:table-cell">
                        <RelativeTime value={j.updated_at} />
                      </TD>
                      <TD align="right" className="hidden md:table-cell">
                        {Number(j.collect_amount) > 0 ? f.money(j.collect_amount, j.currency) : "—"}
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
            <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} makeHref={(n) => `/dashboard/deliveries?tab=${tab.key}&page=${n}${q ? `&q=${encodeURIComponent(q)}` : ""}`} />
          </>
        )}
      </Panel>
    </PageContainer>
  );
}
