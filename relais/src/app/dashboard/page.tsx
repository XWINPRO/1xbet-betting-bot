import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import Link from "next/link";
import { ArrowRight, Check, Circle, Inbox, Truck } from "lucide-react";
import { getStoreContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSetupChecklist, getStoreStats } from "@/lib/data/dashboard";
import { PERIODS, resolvePeriod } from "@/lib/period";
import { msg } from "@/i18n/msg";
import { getStorePlan } from "@/lib/data/plan";
import { PLAN_META } from "@/lib/status";
import { JOB_STATUS, ORDER_SOURCE, ORDER_STATUS, PAYMENT_STATUS } from "@/lib/status";
import { param } from "@/lib/utils";
import { EmptyState, Notice, PageContainer, PageHeader, Stat, StatStrip } from "@/components/ui/page";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/badge";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { RealtimeRefresher } from "@/components/realtime/realtime-refresher";
import type { OrderStatus } from "@/types/domain";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Vue d'ensemble") };
}

const EVENT_LABEL: Record<string, string> = {
  created: msg("Commande créée"),
  status_changed: msg("Statut modifié"),
  payment_changed: msg("Paiement mis à jour"),
  items_updated: msg("Articles modifiés"),
  note: msg("Note ajoutée"),
};

export default async function OverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ctx = await getStoreContext();
  const supabase = await createSupabaseServerClient();
  const period = resolvePeriod(param(sp.period));
  const { t, tn, f } = await getI18n();
  const plan = await getStorePlan(ctx.storeId);

  const [stats, checklist, latestOrders, liveJobs, activity] = await Promise.all([
    getStoreStats(supabase, ctx.storeId, period.from, period.to),
    ctx.isOwner ? getSetupChecklist(supabase, ctx.storeId) : Promise.resolve(null),
    supabase
      .from("orders")
      .select("id, reference, customer_name, status, total, currency, payment_status, source, created_at")
      .eq("store_id", ctx.storeId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("delivery_jobs")
      .select("id, reference, status, dropoff_address, dropoff_name, courier_id, couriers(full_name), orders!delivery_jobs_order_id_fkey(id, reference)")
      .eq("store_id", ctx.storeId)
      .in("status", ["pending", "offered", "accepted", "picked_up", "in_transit"])
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("order_events")
      .select("id, type, to_status, message, created_at, orders(id, reference, customer_name)")
      .eq("store_id", ctx.storeId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const setupSteps = checklist
    ? [
        { done: checklist.location, label: t("Renseigner l'adresse et la position de la boutique"), href: "/dashboard/storefront#localisation" },
        { done: checklist.products, label: t("Ajouter un premier produit"), href: "/dashboard/products/new" },
        plan.max_couriers > 0
          ? { done: checklist.couriers, label: t("Inviter un livreur"), href: "/dashboard/couriers?add=1" }
          : { done: false, label: t("Choisir un plan pour ajouter vos livreurs"), href: "/dashboard/billing" },
        { done: checklist.published, label: t("Publier la boutique en ligne"), href: "/dashboard/storefront" },
        { done: checklist.orders, label: t("Enregistrer une première commande"), href: "/dashboard/orders/new" },
      ]
    : [];
  const setupRemaining = setupSteps.filter((s) => !s.done).length;
  const orders = latestOrders.data ?? [];
  const jobs = liveJobs.data ?? [];
  const events = activity.data ?? [];

  return (
    <PageContainer>
      <RealtimeRefresher channel={`overview-${ctx.storeId}`} tables={["orders", "delivery_jobs"]} filter={`store_id=eq.${ctx.storeId}`} />
      <PageHeader
        title={t("Vue d'ensemble")}
        description={`${ctx.store.name} · ${period.key === "today" ? t("activité du jour") : t("activité des {period}", { period: t(period.label) })}`}
        actions={
          <FilterTabs
            className="rounded-md border border-line bg-surface px-1"
            active={period.key}
            items={PERIODS.map((p) => ({ key: p.key, label: t(p.label), href: `/dashboard?period=${p.key}` }))}
          />
        }
      />

      {param(sp.denied) ? (
        <Notice tone="warning" className="mb-5" title={t("Accès limité")}>
          {t("Votre rôle ne permet pas d'ouvrir cette section. Demandez l'autorisation au propriétaire de la boutique.")}
        </Notice>
      ) : null}

      {ctx.isOwner ? (
        <Notice
          tone={plan.code === "free" ? "accent" : "neutral"}
          className="mb-5"
          title={t("Plan {plan}", { plan: t(PLAN_META[plan.code]?.name ?? plan.code) })}
          action={
            <Link href="/dashboard/billing" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              {plan.code === "free" ? t("Voir les plans") : t("Gérer l'abonnement")}
            </Link>
          }
        >
          {plan.code === "free"
            ? t("Le plan gratuit ne comprend pas de livreurs. Choisissez un plan pour parrainer vos livreurs et suivre vos livraisons.")
            : plan.ends_at
              ? t("Livreurs : {used} / {max} · actif jusqu'au {date}", { used: plan.couriers_used, max: plan.max_couriers, date: f.date(plan.ends_at) })
              : t("Livreurs : {used} / {max}", { used: plan.couriers_used, max: plan.max_couriers })}
          {plan.pending ? ` ${t("Une demande d'abonnement est en cours de vérification.")}` : ""}
        </Notice>
      ) : null}

      <StatStrip>
        {stats.can_view_revenue ? (
          <Stat label={t("Chiffre d'affaires livré")} value={f.money(stats.revenue, ctx.store.currency)} hint={t("Encaissé : {amount}", { amount: f.money(stats.collected, ctx.store.currency) })} />
        ) : null}
        <Stat label={t("Commandes")} value={f.number(stats.orders_count)} hint={stats.cancelled_count ? tn(stats.cancelled_count, "{n} annulée", "{n} annulées") : t("sur la période")} href="/dashboard/orders" />
        <Stat label={t("À traiter")} value={f.number(stats.pending_orders)} hint={tn(stats.new_orders, "{n} nouvelle", "{n} nouvelles")} tone={stats.new_orders > 0 ? "accent" : "default"} href="/dashboard/orders?status=open" />
        <Stat
          label={t("Livraisons en cours")}
          value={f.number(stats.active_deliveries)}
          hint={stats.unassigned_deliveries ? t("{n} sans livreur", { n: stats.unassigned_deliveries }) : t("toutes attribuées")}
          tone={stats.unassigned_deliveries ? "warning" : "default"}
          href="/dashboard/deliveries"
        />
        <Stat label={t("Livrées")} value={f.number(stats.delivered_count)} hint={t("sur la période")} tone="success" />
        <Stat label={t("Échecs")} value={f.number(stats.failed_count)} hint={t("sur la période")} tone={stats.failed_count ? "danger" : "default"} />
        <Stat label={t("Livreurs disponibles")} value={`${f.number(stats.available_couriers)} / ${f.number(stats.couriers_total)}`} hint={t("en temps réel")} href="/dashboard/couriers" />
      </StatStrip>

      {setupRemaining > 0 ? (
        <Panel className="mt-6">
          <PanelHeader
            title={t("Mise en route")}
            description={t("{done} étape(s) sur {total} terminée(s)", { done: setupSteps.length - setupRemaining, total: setupSteps.length })}
          />
          <ul className="divide-y divide-line">
            {setupSteps.map((step) => (
              <li key={step.label}>
                <Link href={step.href} className="flex items-center gap-3 px-5 py-3 text-[13.5px] hover:bg-subtle">
                  {step.done ? (
                    <span className="flex size-5 items-center justify-center rounded-full bg-success text-white">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  ) : (
                    <Circle className="size-5 text-line-strong" />
                  )}
                  <span className={step.done ? "flex-1 text-ink-3 line-through decoration-ink-4" : "flex-1 text-ink"}>{step.label}</span>
                  {!step.done ? <ArrowRight className="size-4 text-ink-4" /> : null}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel>
          <PanelHeader
            title={t("Dernières commandes")}
            actions={
              <Link href="/dashboard/orders" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                {t("Tout voir")} <ArrowRight />
              </Link>
            }
          />
          {orders.length === 0 ? (
            <EmptyState
              icon={<Inbox />}
              title={t("Aucune commande pour l'instant")}
              description={t("Les commandes passées sur votre boutique en ligne et celles que vous saisissez (WhatsApp, téléphone) apparaîtront ici.")}
              action={
                ctx.can("orders.create") ? (
                  <Link href="/dashboard/orders/new" className={buttonVariants({ variant: "primary" })}>
                    {t("Saisir une commande")}
                  </Link>
                ) : null
              }
            />
          ) : (
            <TableWrap>
              <Table>
                <THead>
                  <tr>
                    <TH>{t("Commande")}</TH>
                    <TH>{t("Client")}</TH>
                    <TH>{t("Statut")}</TH>
                    <TH className="hidden md:table-cell">{t("Paiement")}</TH>
                    <TH align="right">{t("Total")}</TH>
                  </tr>
                </THead>
                <tbody>
                  {orders.map((o) => (
                    <TR key={o.id}>
                      <TD>
                        <Link href={`/dashboard/orders/${o.id}`} className="font-medium text-ink hover:text-accent">
                          {o.reference}
                        </Link>
                        <div className="text-xs text-ink-3">
                          {t(ORDER_SOURCE[o.source])} · {f.relative(o.created_at)}
                        </div>
                      </TD>
                      <TD className="max-w-[180px] truncate">{o.customer_name}</TD>
                      <TD>
                        <StatusBadge map={ORDER_STATUS} value={o.status as OrderStatus} />
                      </TD>
                      <TD className="hidden md:table-cell">
                        <StatusBadge map={PAYMENT_STATUS} value={o.payment_status} />
                      </TD>
                      <TD align="right" className="font-medium">
                        {stats.can_view_revenue || ctx.can("orders.edit") ? f.money(o.total, o.currency) : "—"}
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel>
            <PanelHeader
              title={t("Livraisons actives")}
              actions={
                <Link href="/dashboard/deliveries" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  {t("Carte")} <ArrowRight />
                </Link>
              }
            />
            {jobs.length === 0 ? (
              <EmptyState compact icon={<Truck />} title={t("Aucune livraison en cours")} description={t("Créez une livraison depuis une commande prête.")} />
            ) : (
              <ul className="divide-y divide-line">
                {jobs.map((j) => (
                  <li key={j.id}>
                    <Link href={j.orders ? `/dashboard/orders/${j.orders.id}` : "/dashboard/deliveries"} className="flex items-start gap-3 px-5 py-3 hover:bg-subtle">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[12.5px] text-ink">{j.reference}</span>
                          {j.orders ? <span className="text-xs text-ink-3">{j.orders.reference}</span> : null}
                        </div>
                        <p className="mt-0.5 truncate text-[13px] text-ink-2">{j.dropoff_address}</p>
                        <p className="text-xs text-ink-3">{j.couriers?.full_name ?? t("Aucun livreur attribué")}</p>
                      </div>
                      <StatusBadge map={JOB_STATUS} value={j.status} pulse={j.status === "in_transit"} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader title={t("Activité récente")} />
            {events.length === 0 ? (
              <EmptyState compact title={t("Pas encore d'activité")} />
            ) : (
              <ol className="px-5 py-3">
                {events.map((e) => (
                  <li key={e.id} className="relative flex gap-3 pb-3 last:pb-0">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ink-4" />
                    <div className="min-w-0 text-[13px]">
                      <p className="text-ink">
                        {EVENT_LABEL[e.type] ? t(EVENT_LABEL[e.type]) : e.type}
                        {e.type === "status_changed" && e.to_status ? ` : ${ORDER_STATUS[e.to_status as OrderStatus] ? t(ORDER_STATUS[e.to_status as OrderStatus].label) : e.to_status}` : ""}
                        {e.orders ? (
                          <>
                            {" · "}
                            <Link href={`/dashboard/orders/${e.orders.id}`} className="font-medium hover:text-accent">
                              {e.orders.reference}
                            </Link>
                          </>
                        ) : null}
                      </p>
                      <p className="text-xs text-ink-3" title={f.dateTime(e.created_at)}>
                        {f.relative(e.created_at)}
                        {e.orders?.customer_name ? ` · ${e.orders.customer_name}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </PageContainer>
  );
}
