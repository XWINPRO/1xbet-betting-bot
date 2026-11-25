import { getI18n } from "@/i18n/server";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bike, MapPin } from "lucide-react";
import { getStoreContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { COURIER_ACCOUNT, COURIER_STATUS, VEHICLES } from "@/lib/status";
import { formatPhone } from "@/lib/phone";
import { secondsSince } from "@/lib/format";
import { toLatLng } from "@/lib/geo";
import { getStorePlan } from "@/lib/data/plan";
import { PLAN_META } from "@/lib/status";
import { buttonVariants } from "@/components/ui/button";
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

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Livreurs") };
}

export default async function CouriersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ctx = await getStoreContext();
  if (!ctx.can("couriers.assign")) redirect("/dashboard?denied=1");
  const { t, tn } = await getI18n();
  const plan = await getStorePlan(ctx.storeId);
  const canAdd = plan.couriers_used < plan.max_couriers;
  const liveTracking = plan.tracking === "live";
  const addAction = ctx.isOwner ? (
    canAdd ? (
      <CourierFormDialog mode="create" storeName={ctx.store.name} defaultOpen={param(sp.add) === "1"} />
    ) : (
      <Link href="/dashboard/billing" className={buttonVariants({ variant: "primary" })}>
        {plan.max_couriers === 0 ? t("Choisir un plan") : t("Augmenter la limite")}
      </Link>
    )
  ) : null;
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
        title={t("Livreurs")}
        description={t("Les livreurs que vous parrainez. Un livreur est « occupé » dès {n} course(s) active(s) ; « hors ligne » sans signal récent de son téléphone.", { n: store?.courier_max_active_jobs ?? 1 })}
        actions={addAction}
      />

      <Notice
        tone={canAdd ? "neutral" : "accent"}
        className="mb-5"
        title={t("Plan {plan} · {used} / {max} livreurs", { plan: t(PLAN_META[plan.code]?.name ?? plan.code), used: plan.couriers_used, max: plan.max_couriers })}
      >
        {plan.max_couriers === 0
          ? t("Le plan gratuit ne comprend pas de livreurs. Choisissez un plan dans Abonnement pour parrainer vos livreurs.")
          : canAdd
            ? tn(plan.max_couriers - plan.couriers_used, "Vous pouvez encore ajouter {n} livreur.", "Vous pouvez encore ajouter {n} livreurs.")
            : t("Limite de votre plan atteinte. Suspendez l'accès d'un livreur ou passez à un plan supérieur.")}
      </Notice>

      {couriers.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Bike />}
            title={t("Aucun livreur")}
            description={t("Ajoutez vos livreurs : chacun reçoit un lien pour activer son espace sur son téléphone et recevoir vos courses.")}
            action={ctx.isOwner && canAdd ? <CourierFormDialog mode="create" storeName={ctx.store.name} /> : null}
          />
        </Panel>
      ) : (
        <>
          <StatStrip className="mb-6">
            <Stat label={t("Disponibles")} value={count("available")} tone="success" />
            <Stat label={t("En livraison")} value={count("busy")} tone="accent" />
            <Stat label={t("Indisponibles")} value={count("unavailable")} />
            <Stat label={t("Hors ligne")} value={count("offline")} />
            <Stat label={t("Inactifs ou en attente")} value={count("inactive")} />
          </StatStrip>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Panel>
              <TableWrap>
                <Table>
                  <THead>
                    <tr>
                      <TH>{t("Livreur")}</TH>
                      <TH>{t("Disponibilité")}</TH>
                      <TH className="hidden md:table-cell">{t("Courses")}</TH>
                      <TH className="hidden lg:table-cell">{t("Dernier signal")}</TH>
                      <TH className="hidden sm:table-cell">{t("Compte")}</TH>
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
                            {c.vehicle_type ? ` · ${VEHICLES[c.vehicle_type] ? t(VEHICLES[c.vehicle_type]) : c.vehicle_type}` : ""}
                            {c.zone ? ` · ${c.zone}` : ""}
                          </div>
                        </TD>
                        <TD>
                          <StatusBadge map={COURIER_STATUS} value={c.effective_status as EffectiveCourierStatus} pulse={c.effective_status === "busy"} />
                        </TD>
                        <TD className="hidden tabular md:table-cell">
                          {t("{n} en cours", { n: c.active_jobs })}
                          <div className="text-xs text-ink-3">{t("{n} livrées (30 j)", { n: c.delivered_30d })}</div>
                        </TD>
                        <TD className="hidden text-ink-3 lg:table-cell">
                          <RelativeTime value={c.last_seen_at} />
                          {c.last_location_at ? (
                            <div className="flex items-center gap-1 text-xs">
                              <MapPin className="size-3" /> {t("position partagée")}
                            </div>
                          ) : null}
                        </TD>
                        <TD className="hidden sm:table-cell">
                          {c.membership_status === "suspended" ? (
                            <Badge tone="danger">{t("Accès suspendu")}</Badge>
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
            {liveTracking ? (
            <Panel className="self-start overflow-hidden">
              <PanelHeader title={t("Positions partagées")} description={t("Livreurs disponibles ou en course pour vous.")} />
              {onMap.length ? (
                <CouriersMap couriers={onMap} store={toLatLng(store?.lat, store?.lng)} />
              ) : (
                <div className="px-5 py-4">
                  <Notice tone="neutral">
                    {t("Aucune position partagée pour le moment. Les positions apparaissent quand un livreur est disponible ou en course, avec la localisation autorisée sur son téléphone.")}
                  </Notice>
                </div>
              )}
            </Panel>
            ) : (
              <Panel className="self-start">
                <div className="px-5 py-4">
                  <Notice tone="neutral" title={t("Carte des livreurs")}>
                    {t("La position GPS des livreurs est incluse dans les plans Pro et Entreprise.")}
                  </Notice>
                </div>
              </Panel>
            )}
          </div>
        </>
      )}
    </PageContainer>
  );
}
