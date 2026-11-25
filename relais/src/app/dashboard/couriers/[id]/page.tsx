import { getI18n } from "@/i18n/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStoreContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { COURIER_ACCOUNT, COURIER_STATUS, JOB_STATUS, VEHICLES } from "@/lib/status";
import { secondsSince } from "@/lib/format";
import { getStorePlan } from "@/lib/data/plan";
import { formatPhone, telHref } from "@/lib/phone";
import { toLatLng } from "@/lib/geo";
import { whatsappUrl } from "@/lib/whatsapp";
import { EmptyState, PageContainer, PageHeader, Stat, StatStrip } from "@/components/ui/page";
import { Panel, PanelHeader, DescriptionList } from "@/components/ui/panel";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { RealtimeRefresher } from "@/components/realtime/realtime-refresher";
import { CourierFormDialog } from "@/components/couriers/courier-form-dialog";
import { CourierAccessButton, CourierInviteButton } from "@/components/couriers/courier-access";
import { CouriersMap } from "@/components/couriers/couriers-map";
import type { BoardCourier, EffectiveCourierStatus } from "@/types/domain";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Livreur") };
}

export default async function CourierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getStoreContext();
  if (!ctx.can("couriers.assign")) redirect("/dashboard?denied=1");
  const { t, f } = await getI18n();
  const plan = await getStorePlan(ctx.storeId);
  const supabase = await createSupabaseServerClient();
  const [{ data: board }, { data: jobs }, { data: courierRow }, { data: stale }] = await Promise.all([
    supabase.rpc("store_courier_board", { p_store_id: ctx.storeId }),
    supabase
      .from("delivery_jobs")
      .select("id, reference, status, dropoff_address, collect_amount, currency, created_at, accepted_at, delivered_at, failed_at, orders!delivery_jobs_order_id_fkey(id, reference)")
      .eq("store_id", ctx.storeId)
      .eq("courier_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("couriers").select("notes").eq("id", id).maybeSingle(),
    supabase.from("platform_settings").select("value").eq("key", "location.stale_after_s").maybeSingle(),
  ]);
  const c = ((board ?? []) as BoardCourier[]).find((x) => x.courier_id === id);
  if (!c) notFound();
  const list = jobs ?? [];
  const delivered = list.filter((j) => j.status === "delivered");
  const failed = list.filter((j) => j.status === "failed");
  const durations = delivered.filter((j) => j.accepted_at && j.delivered_at).map((j) => (new Date(j.delivered_at!).getTime() - new Date(j.accepted_at!).getTime()) / 60000);
  const avg = durations.length ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length) : null;
  const position = toLatLng(c.last_lat, c.last_lng);
  const staleAfter = Number(stale?.value ?? 120);

  return (
    <PageContainer>
      <RealtimeRefresher channel={`courier-${id}`} tables={["couriers", "delivery_jobs"]} filter={undefined} debounceMs={1500} />
      <PageHeader
        back={{ href: "/dashboard/couriers", label: t("Livreurs") }}
        title={c.full_name}
        meta={<StatusBadge map={COURIER_STATUS} value={c.effective_status as EffectiveCourierStatus} />}
        description={COURIER_STATUS[c.effective_status as EffectiveCourierStatus] ? t(COURIER_STATUS[c.effective_status as EffectiveCourierStatus].hint) : undefined}
        actions={
          <>
            <Button asChild variant="secondary">
              <a href={telHref(c.phone) ?? "#"}>{t("Appeler")}</a>
            </Button>
            <WhatsAppButton href={whatsappUrl(c.phone)} label="WhatsApp" />
            {ctx.isOwner ? (
              <>
                {!c.linked ? <CourierInviteButton courierId={c.courier_id} phone={c.phone} storeName={ctx.store.name} /> : null}
                {c.kind === "private" ? (
                  <CourierFormDialog
                    mode="edit"
                    courierId={c.courier_id}
                    storeName={ctx.store.name}
                    initial={{
                      full_name: c.full_name,
                      phone: c.phone,
                      vehicle_type: c.vehicle_type ?? "moto",
                      vehicle_plate: c.vehicle_plate ?? "",
                      zone: c.zone ?? "",
                      zone_lat: c.zone_lat,
                      zone_lng: c.zone_lng,
                      zone_radius_km: c.zone_radius_km ? String(c.zone_radius_km) : "",
                      notes: courierRow?.notes ?? "",
                    }}
                  />
                ) : null}
                <CourierAccessButton courierId={c.courier_id} active={c.membership_status === "active"} />
              </>
            ) : null}
          </>
        }
      />
      <StatStrip className="mb-6">
        <Stat label={t("Courses en cours")} value={c.active_jobs} />
        <Stat label={t("Livrées (toutes)")} value={delivered.length} tone="success" />
        <Stat label={t("Échecs")} value={failed.length} tone={failed.length ? "danger" : "default"} />
        <Stat label={t("Durée moyenne")} value={avg !== null ? `${avg} min` : "—"} hint={t("acceptation → livraison")} />
      </StatStrip>
      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Panel>
            <PanelHeader title={t("Profil")} />
            <div className="px-5 py-2">
              <DescriptionList
                items={[
                  { label: t("Téléphone"), value: formatPhone(c.phone) },
                  { label: t("Transport"), value: c.vehicle_type ? `${VEHICLES[c.vehicle_type] ? t(VEHICLES[c.vehicle_type]) : c.vehicle_type}${c.vehicle_plate ? ` · ${c.vehicle_plate}` : ""}` : "—" },
                  { label: t("Zone"), value: c.zone ? `${c.zone}${c.zone_radius_km ? ` (${c.zone_radius_km} km)` : ""}` : "—" },
                  { label: t("Compte"), value: c.membership_status === "suspended" ? <Badge tone="danger">{t("Accès suspendu")}</Badge> : <StatusBadge map={COURIER_ACCOUNT} value={c.account_status} /> },
                  { label: t("Dernier signal"), value: c.last_seen_at ? f.relative(c.last_seen_at) : t("Jamais") },
                  ...(courierRow?.notes ? [{ label: t("Notes"), value: courierRow.notes }] : []),
                ]}
              />
            </div>
          </Panel>
          <Panel className="overflow-hidden">
            <PanelHeader title={t("Dernière position")} description={c.last_location_at ? t("Reçue {when}", { when: f.relative(c.last_location_at) }) : undefined} />
            {plan.tracking !== "live" ? (
              <p className="px-5 py-4 text-[13px] text-ink-3">{t("La position GPS des livreurs est incluse dans les plans Pro et Entreprise.")}</p>
            ) : position ? (
              <CouriersMap
                height={240}
                store={null}
                couriers={[{ id: c.courier_id, lat: position.lat, lng: position.lng, accuracy: c.last_accuracy, label: c.full_name, highlight: true, status: c.effective_status as EffectiveCourierStatus, stale: (secondsSince(c.last_location_at) ?? Infinity) > staleAfter }]}
              />
            ) : (
              <p className="px-5 py-4 text-[13px] text-ink-3">{t("Position non partagée : le livreur est indisponible, hors course, ou n'a pas autorisé la localisation.")}</p>
            )}
          </Panel>
        </div>
        <Panel>
          <PanelHeader title={t("Historique des courses")} />
          {!list.length ? (
            <EmptyState compact title={t("Aucune course pour votre boutique")} />
          ) : (
            <TableWrap>
              <Table>
                <THead>
                  <tr>
                    <TH>{t("Course")}</TH>
                    <TH>{t("Statut")}</TH>
                    <TH className="hidden md:table-cell">{t("Destination")}</TH>
                    <TH align="right" className="hidden sm:table-cell">{t("À encaisser")}</TH>
                  </tr>
                </THead>
                <tbody>
                  {list.map((j) => (
                    <TR key={j.id}>
                      <TD>
                        {j.orders ? (
                          <Link href={`/dashboard/orders/${j.orders.id}`} className="font-medium hover:text-accent">
                            {j.orders.reference}
                          </Link>
                        ) : null}
                        <div className="font-mono text-xs text-ink-3">{j.reference}</div>
                      </TD>
                      <TD>
                        <StatusBadge map={JOB_STATUS} value={j.status} />
                        <div className="mt-0.5 text-xs text-ink-3">{f.dateTime(j.delivered_at ?? j.failed_at ?? j.created_at)}</div>
                      </TD>
                      <TD className="hidden max-w-[260px] truncate text-ink-2 md:table-cell">{j.dropoff_address}</TD>
                      <TD align="right" className="hidden sm:table-cell">
                        {Number(j.collect_amount) > 0 ? f.money(j.collect_amount, j.currency) : "—"}
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Panel>
      </div>
    </PageContainer>
  );
}
