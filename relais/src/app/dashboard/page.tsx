import Link from "next/link";
import { ArrowRight, Check, Circle, Inbox, Truck } from "lucide-react";
import { getStoreContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSetupChecklist, getStoreStats } from "@/lib/data/dashboard";
import { PERIODS, resolvePeriod } from "@/lib/period";
import { formatMoney, formatNumber, formatDateTime, formatRelative } from "@/lib/format";
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

export const metadata = { title: "Vue d'ensemble" };

const EVENT_LABEL: Record<string, string> = {
  created: "Commande créée",
  status_changed: "Statut modifié",
  payment_changed: "Paiement mis à jour",
  items_updated: "Articles modifiés",
  note: "Note ajoutée",
};

export default async function OverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ctx = await getStoreContext();
  const supabase = await createSupabaseServerClient();
  const period = resolvePeriod(param(sp.period));

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
        { done: checklist.location, label: "Renseigner l'adresse et la position de la boutique", href: "/dashboard/storefront#localisation" },
        { done: checklist.products, label: "Ajouter un premier produit", href: "/dashboard/products/new" },
        { done: checklist.couriers, label: "Inviter un livreur", href: "/dashboard/couriers?add=1" },
        { done: checklist.published, label: "Publier la boutique en ligne", href: "/dashboard/storefront" },
        { done: checklist.orders, label: "Enregistrer une première commande", href: "/dashboard/orders/new" },
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
        title="Vue d'ensemble"
        description={`${ctx.store.name} · activité ${period.key === "today" ? "du jour" : `des ${period.label}`}`}
        actions={
          <FilterTabs
            className="rounded-md border border-line bg-surface px-1"
            active={period.key}
            items={PERIODS.map((p) => ({ key: p.key, label: p.label, href: `/dashboard?period=${p.key}` }))}
          />
        }
      />

      {param(sp.denied) ? (
        <Notice tone="warning" className="mb-5" title="Accès limité">
          Votre rôle ne permet pas d&apos;ouvrir cette section. Demandez l&apos;autorisation au propriétaire de la boutique.
        </Notice>
      ) : null}

      <StatStrip>
        {stats.can_view_revenue ? (
          <Stat label="Chiffre d'affaires livré" value={formatMoney(stats.revenue, ctx.store.currency)} hint={`Encaissé : ${formatMoney(stats.collected, ctx.store.currency)}`} />
        ) : null}
        <Stat label="Commandes" value={formatNumber(stats.orders_count)} hint={stats.cancelled_count ? `${stats.cancelled_count} annulée(s)` : "sur la période"} href="/dashboard/orders" />
        <Stat label="À traiter" value={formatNumber(stats.pending_orders)} hint={`${stats.new_orders} nouvelle(s)`} tone={stats.new_orders > 0 ? "accent" : "default"} href="/dashboard/orders?status=open" />
        <Stat
          label="Livraisons en cours"
          value={formatNumber(stats.active_deliveries)}
          hint={stats.unassigned_deliveries ? `${stats.unassigned_deliveries} sans livreur` : "toutes attribuées"}
          tone={stats.unassigned_deliveries ? "warning" : "default"}
          href="/dashboard/deliveries"
        />
        <Stat label="Livrées" value={formatNumber(stats.delivered_count)} hint="sur la période" tone="success" />
        <Stat label="Échecs" value={formatNumber(stats.failed_count)} hint="sur la période" tone={stats.failed_count ? "danger" : "default"} />
        <Stat label="Livreurs disponibles" value={`${formatNumber(stats.available_couriers)} / ${formatNumber(stats.couriers_total)}`} hint="en temps réel" href="/dashboard/couriers" />
      </StatStrip>

      {setupRemaining > 0 ? (
        <Panel className="mt-6">
          <PanelHeader
            title="Mise en route"
            description={`${setupSteps.length - setupRemaining} étape(s) sur ${setupSteps.length} terminée(s)`}
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
            title="Dernières commandes"
            actions={
              <Link href="/dashboard/orders" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Tout voir <ArrowRight />
              </Link>
            }
          />
          {orders.length === 0 ? (
            <EmptyState
              icon={<Inbox />}
              title="Aucune commande pour l'instant"
              description="Les commandes passées sur votre boutique en ligne et celles que vous saisissez (WhatsApp, téléphone) apparaîtront ici."
              action={
                ctx.can("orders.create") ? (
                  <Link href="/dashboard/orders/new" className={buttonVariants({ variant: "primary" })}>
                    Saisir une commande
                  </Link>
                ) : null
              }
            />
          ) : (
            <TableWrap>
              <Table>
                <THead>
                  <tr>
                    <TH>Commande</TH>
                    <TH>Client</TH>
                    <TH>Statut</TH>
                    <TH className="hidden md:table-cell">Paiement</TH>
                    <TH align="right">Total</TH>
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
                          {ORDER_SOURCE[o.source]} · {formatRelative(o.created_at)}
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
                        {stats.can_view_revenue || ctx.can("orders.edit") ? formatMoney(o.total, o.currency) : "—"}
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
              title="Livraisons actives"
              actions={
                <Link href="/dashboard/deliveries" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  Carte <ArrowRight />
                </Link>
              }
            />
            {jobs.length === 0 ? (
              <EmptyState compact icon={<Truck />} title="Aucune livraison en cours" description="Créez une livraison depuis une commande prête." />
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
                        <p className="text-xs text-ink-3">{j.couriers?.full_name ?? "Aucun livreur attribué"}</p>
                      </div>
                      <StatusBadge map={JOB_STATUS} value={j.status} pulse={j.status === "in_transit"} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Activité récente" />
            {events.length === 0 ? (
              <EmptyState compact title="Pas encore d'activité" />
            ) : (
              <ol className="px-5 py-3">
                {events.map((e) => (
                  <li key={e.id} className="relative flex gap-3 pb-3 last:pb-0">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ink-4" />
                    <div className="min-w-0 text-[13px]">
                      <p className="text-ink">
                        {EVENT_LABEL[e.type] ?? e.type}
                        {e.type === "status_changed" && e.to_status ? ` : ${ORDER_STATUS[e.to_status as OrderStatus]?.label ?? e.to_status}` : ""}
                        {e.orders ? (
                          <>
                            {" · "}
                            <Link href={`/dashboard/orders/${e.orders.id}`} className="font-medium hover:text-accent">
                              {e.orders.reference}
                            </Link>
                          </>
                        ) : null}
                      </p>
                      <p className="text-xs text-ink-3" title={formatDateTime(e.created_at)}>
                        {formatRelative(e.created_at)}
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
