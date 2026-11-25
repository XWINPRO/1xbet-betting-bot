import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolvePeriod } from "@/lib/period";
import { formatDate, formatMoney, formatNumber, formatShortDate } from "@/lib/format";
import { param } from "@/lib/utils";
import { PageContainer, PageHeader, Stat, StatStrip, Notice } from "@/components/ui/page";
import { Panel, PanelHeader, PanelBody } from "@/components/ui/panel";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { BarChart } from "@/components/charts/bar-chart";
import { buttonVariants } from "@/components/ui/button";

type Overview = {
  stores_total: number;
  stores_published: number;
  stores_suspended: number;
  users_total: number;
  users_suspended: number;
  platform_couriers_active: number;
  courier_applications: number;
  private_couriers: number;
  orders_count: number;
  gmv: number;
  on_demand_count: number;
  on_demand_revenue: number;
  pending_on_demand: number;
  active_jobs: number;
  delivered_count: number;
  failed_count: number;
  open_claims: number;
  pending_transactions: number;
};

export default async function AdminOverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const period = resolvePeriod(param(sp.period) ?? "30d");
  const supabase = await createSupabaseServerClient();
  const [{ data: o }, { data: series }] = await Promise.all([
    supabase.rpc("admin_overview_stats", { p_from: period.from.toISOString(), p_to: period.to.toISOString() }),
    supabase.rpc("admin_daily_series", { p_from: period.fromDate, p_to: period.toDate }),
  ]);
  const s = o as unknown as Overview;
  const days = (series ?? []).map((d) => ({ key: d.bucket_day, label: formatShortDate(`${d.bucket_day}T12:00:00Z`), fullLabel: formatDate(`${d.bucket_day}T12:00:00Z`), d }));
  const hasActivity = days.some(({ d }) => d.orders_count || d.on_demand_count || d.delivered_count || d.failed_count);
  const alerts = [
    s.courier_applications ? { href: "/admin/couriers?tab=review", text: `${s.courier_applications} candidature(s) de livreur à examiner` } : null,
    s.pending_on_demand ? { href: "/admin/deliveries?source=on_demand&tab=pending", text: `${s.pending_on_demand} course(s) ponctuelle(s) sans livreur` } : null,
    s.open_claims ? { href: "/admin/claims", text: `${s.open_claims} réclamation(s) ouverte(s)` } : null,
    s.pending_transactions ? { href: "/admin/payments", text: `${s.pending_transactions} paiement(s) à confirmer` } : null,
  ].filter(Boolean) as { href: string; text: string }[];

  return (
    <PageContainer>
      <PageHeader
        title="Vue globale"
        description={`Activité de la plateforme — ${period.label}`}
        actions={
          <FilterTabs
            className="rounded-md border border-line bg-surface px-1"
            active={period.key}
            items={[
              { key: "today", label: "Aujourd'hui", href: "/admin?period=today" },
              { key: "7d", label: "7 jours", href: "/admin?period=7d" },
              { key: "30d", label: "30 jours", href: "/admin?period=30d" },
              { key: "90d", label: "90 jours", href: "/admin?period=90d" },
            ]}
          />
        }
      />
      {alerts.length ? (
        <div className="mb-6 flex flex-col gap-2">
          {alerts.map((a) => (
            <Notice key={a.href} tone="warning" action={<Link href={a.href} className={buttonVariants({ size: "sm", variant: "secondary" })}>Traiter <ArrowRight /></Link>}>
              {a.text}
            </Notice>
          ))}
        </div>
      ) : null}
      <StatStrip className="mb-4">
        <Stat label="Volume livré (boutiques)" value={formatMoney(s.gmv, "XAF")} />
        <Stat label="Commandes" value={formatNumber(s.orders_count)} href="/admin/orders" />
        <Stat label="Courses ponctuelles" value={formatNumber(s.on_demand_count)} hint={`${formatMoney(s.on_demand_revenue, "XAF")} livrées`} href="/admin/deliveries?source=on_demand" />
        <Stat label="Courses actives" value={formatNumber(s.active_jobs)} tone="accent" href="/admin/deliveries" />
        <Stat label="Livrées / échecs" value={`${formatNumber(s.delivered_count)} / ${formatNumber(s.failed_count)}`} />
      </StatStrip>
      <StatStrip className="mb-6">
        <Stat label="Boutiques" value={formatNumber(s.stores_total)} hint={`${s.stores_published} publiées · ${s.stores_suspended} suspendues`} href="/admin/stores" />
        <Stat label="Utilisateurs" value={formatNumber(s.users_total)} hint={`${s.users_suspended} suspendus`} href="/admin/users" />
        <Stat label="Livreurs du réseau actifs" value={formatNumber(s.platform_couriers_active)} href="/admin/couriers" />
        <Stat label="Livreurs de boutiques" value={formatNumber(s.private_couriers)} />
      </StatStrip>
      <Panel>
        <PanelHeader title="Activité quotidienne" description="Commandes de boutiques et courses ponctuelles créées par jour" />
        <PanelBody>
          {hasActivity ? (
            <BarChart
              title="Commandes et courses ponctuelles par jour"
              data={days.map(({ key, label, fullLabel, d }) => ({ key, label, fullLabel, values: { orders: d.orders_count, on_demand: d.on_demand_count } }))}
              series={[
                { key: "orders", label: "Commandes de boutiques", color: "#2563EB" },
                { key: "on_demand", label: "Courses ponctuelles", color: "#D97706" },
              ]}
            />
          ) : (
            <p className="py-8 text-center text-[13px] text-ink-3">Aucune activité sur la période.</p>
          )}
        </PanelBody>
      </Panel>
    </PageContainer>
  );
}
