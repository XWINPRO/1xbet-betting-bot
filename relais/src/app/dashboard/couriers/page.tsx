import Link from "next/link";
import { redirect } from "next/navigation";
import { Bike, MapPin } from "lucide-react";
import { getStoreContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { COURIER_ACCOUNT, COURIER_STATUS, VEHICLES } from "@/lib/status";
import { formatPhone } from "@/lib/phone";
import { secondsSince } from "@/lib/format";
import { toLatLng } from "@/lib/geo";
import { param } from "@/lib/utils";
import { EmptyState, Notice, PageContainer, PageHeader, Stat, StatStrip } from "@/components/ui/page";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { RelativeTime } from "@/components/ui/client-helpers";
import { RealtimeRefresher } from "@/components/realtime/realtime-refresher";
import { CourierFormDialog } from "@/components/couriers/courier-form-dialog";
import { CouriersMap } from "@/components/couriers/couriers-map";
import type { BoardCourier, EffectiveCourierStatus } from "@/types/domain";

export const metadata = { title: "Livreurs" };

export default async function CouriersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ctx = await getStoreContext();
  if (!ctx.can("couriers.assign")) redirect("/dashboard?denied=1");
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, { data: store }, { data: stale }] = await Promise.all([
    supabase.rpc("store_courier_board", { p_store_id: ctx.storeId }),
    supabase.from("stores").select("lat, lng, courier_max_active_jobs").eq("id", ctx.storeId).single(),
    supabase.from("platform_settings").select("value").eq("key", "location.stale_after_s").maybeSingle(),
  ]);
  if (error) throw error;
  const couriers = (data ?? []) as BoardCourier[];
  const staleAfter = Number(stale?.value ?? 120);
  const count = (s: EffectiveCourierStatus) => couriers.filter((c) => c.effective_status === s).length;
  const onMap = couriers
    .filter((c) => c.last_lat !== null && c.last_lng !== null)
    .map((c) => ({
      id: c.courier_id,
      lat: c.last_lat!,
      lng: c.last_lng!,
      label: c.full_name,
      accuracy: c.last_accuracy,
      status: c.effective_status as EffectiveCourierStatus,
      stale: (secondsSince(c.last_location_at) ?? Infinity) > staleAfter,
    }));

  return (
    <PageContainer>
      <RealtimeRefresher channel={`couriers-${ctx.storeId}`} tables={["couriers", "delivery_jobs"]} debounceMs={1500} />
      <PageHeader
        title="Livreurs"
        description={`Vos livreurs privés. Un livreur est « occupé » dès ${store?.courier_max_active_jobs ?? 1} course(s) active(s) ; « hors ligne » sans signal récent de son téléphone.`}
        actions={ctx.isOwner ? <CourierFormDialog mode="create" storeName={ctx.store.name} defaultOpen={param(sp.add) === "1"} /> : null}
      />

      {couriers.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Bike />}
            title="Aucun livreur"
            description="Ajoutez vos livreurs : chacun reçoit un lien pour activer son espace sur son téléphone, partager sa position et recevoir vos courses."
            action={ctx.isOwner ? <CourierFormDialog mode="create" storeName={ctx.store.name} /> : null}
          />
        </Panel>
      ) : (
        <>
          <StatStrip className="mb-6">
            <Stat label="Disponibles" value={count("available")} tone="success" />
            <Stat label="En livraison" value={count("busy")} tone="accent" />
            <Stat label="Indisponibles" value={count("unavailable")} />
            <Stat label="Hors ligne" value={count("offline")} />
            <Stat label="Inactifs ou en attente" value={count("inactive")} />
          </StatStrip>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Panel>
              <TableWrap>
                <Table>
                  <THead>
                    <tr>
                      <TH>Livreur</TH>
                      <TH>Disponibilité</TH>
                      <TH className="hidden md:table-cell">Courses</TH>
                      <TH className="hidden lg:table-cell">Dernier signal</TH>
                      <TH className="hidden sm:table-cell">Compte</TH>
                    </tr>
                  </THead>
                  <tbody>
                    {couriers.map((c) => (
                      <TR key={c.courier_id}>
                        <TD>
                          <Link href={`/dashboard/couriers/${c.courier_id}`} className="font-medium text-ink hover:text-accent">
                            {c.full_name}
                          </Link>
                          <div className="text-xs text-ink-3">
                            {formatPhone(c.phone)}
                            {c.vehicle_type ? ` · ${VEHICLES[c.vehicle_type] ?? c.vehicle_type}` : ""}
                            {c.zone ? ` · ${c.zone}` : ""}
                          </div>
                        </TD>
                        <TD>
                          <StatusBadge map={COURIER_STATUS} value={c.effective_status as EffectiveCourierStatus} pulse={c.effective_status === "busy"} />
                        </TD>
                        <TD className="hidden tabular md:table-cell">
                          {c.active_jobs} en cours
                          <div className="text-xs text-ink-3">{c.delivered_30d} livrées (30 j)</div>
                        </TD>
                        <TD className="hidden text-ink-3 lg:table-cell">
                          <RelativeTime value={c.last_seen_at} />
                          {c.last_location_at ? (
                            <div className="flex items-center gap-1 text-xs">
                              <MapPin className="size-3" /> position partagée
                            </div>
                          ) : null}
                        </TD>
                        <TD className="hidden sm:table-cell">
                          {c.membership_status === "suspended" ? (
                            <Badge tone="danger">Accès suspendu</Badge>
                          ) : (
                            <StatusBadge map={COURIER_ACCOUNT} value={c.account_status} />
                          )}
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            </Panel>
            <Panel className="self-start overflow-hidden">
              <PanelHeader title="Positions partagées" description="Livreurs disponibles ou en course pour vous." />
              {onMap.length ? (
                <CouriersMap couriers={onMap} store={toLatLng(store?.lat, store?.lng)} />
              ) : (
                <div className="px-5 py-4">
                  <Notice tone="neutral">
                    Aucune position partagée pour le moment. Les positions apparaissent quand un livreur est disponible ou en course, avec la localisation autorisée sur son téléphone.
                  </Notice>
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </PageContainer>
  );
}
