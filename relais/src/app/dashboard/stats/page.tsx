import { requireStorePermission } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStoreStats } from "@/lib/data/dashboard";
import { resolvePeriod } from "@/lib/period";
import { formatMoney, formatNumber, formatShortDate, formatDate } from "@/lib/format";
import { ORDER_SOURCE, PAYMENT_METHOD } from "@/lib/status";
import { param } from "@/lib/utils";
import { EmptyState, PageContainer, PageHeader, Stat, StatStrip } from "@/components/ui/page";
import { Panel, PanelHeader, PanelBody } from "@/components/ui/panel";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { BarChart, BarList } from "@/components/charts/bar-chart";
import type { OrderSource, PaymentMethod } from "@/types/domain";

export const metadata = { title: "Statistiques" };

const PERIOD_OPTIONS = [
  { key: "7d", label: "7 jours" },
  { key: "30d", label: "30 jours" },
  { key: "90d", label: "90 jours" },
];

export default async function StatsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requireStorePermission("stats.view");
  const supabase = await createSupabaseServerClient();
  const requested = param(sp.period);
  const period = resolvePeriod(requested === "today" ? "7d" : requested ?? "30d");
  const currency = ctx.store.currency;

  const [stats, series, top, perf, orders, txs] = await Promise.all([
    getStoreStats(supabase, ctx.storeId, period.from, period.to),
    supabase.rpc("store_daily_series", { p_store_id: ctx.storeId, p_from: period.fromDate, p_to: period.toDate }),
    supabase.rpc("store_top_products", { p_store_id: ctx.storeId, p_from: period.from.toISOString(), p_to: period.to.toISOString(), p_limit: 8 }),
    supabase.rpc("store_courier_performance", { p_store_id: ctx.storeId, p_from: period.from.toISOString(), p_to: period.to.toISOString() }),
    supabase.from("orders").select("source, status").eq("store_id", ctx.storeId).gte("created_at", period.from.toISOString()).lt("created_at", period.to.toISOString()),
    supabase.from("transactions").select("method, amount").eq("store_id", ctx.storeId).eq("status", "confirmed").gte("confirmed_at", period.from.toISOString()).lt("confirmed_at", period.to.toISOString()),
  ]);

  const days = (series.data ?? []).map((d) => ({
    key: d.bucket_day,
    label: formatShortDate(`${d.bucket_day}T12:00:00Z`),
    fullLabel: formatDate(`${d.bucket_day}T12:00:00Z`),
    orders: d.orders_count,
    revenue: Number(d.revenue_amount),
    delivered: d.delivered_count,
    failed: d.failed_count,
  }));
  const hasActivity = days.some((d) => d.orders || d.revenue || d.delivered || d.failed);
  const bySource = Object.entries(
    (orders.data ?? []).reduce<Record<string, number>>((acc, o) => ((acc[o.source] = (acc[o.source] ?? 0) + 1), acc), {}),
  )
    .map(([k, v]) => ({ label: ORDER_SOURCE[k as OrderSource] ?? k, value: v }))
    .sort((a, b) => b.value - a.value);
  const byMethod = Object.entries(
    (txs.data ?? []).reduce<Record<string, number>>((acc, t) => ((acc[t.method] = (acc[t.method] ?? 0) + Number(t.amount)), acc), {}),
  )
    .map(([k, v]) => ({ label: PAYMENT_METHOD[k as PaymentMethod] ?? k, value: v }))
    .sort((a, b) => b.value - a.value);
  const finished = stats.delivered_count + stats.failed_count;
  const successRate = finished ? Math.round((stats.delivered_count / finished) * 100) : null;

  return (
    <PageContainer>
      <PageHeader
        title="Statistiques"
        description={`Ventes et livraisons — ${period.label}, calculées à partir de vos données.`}
        actions={
          <FilterTabs
            className="rounded-md border border-line bg-surface px-1"
            active={period.key}
            items={PERIOD_OPTIONS.map((p) => ({ key: p.key, label: p.label, href: `/dashboard/stats?period=${p.key}` }))}
          />
        }
      />
      <StatStrip className="mb-6">
        <Stat label="Chiffre d'affaires livré" value={formatMoney(stats.revenue, currency)} />
        <Stat label="Encaissé (confirmé)" value={formatMoney(stats.collected, currency)} hint={stats.pending_cash ? `${formatMoney(stats.pending_cash, currency)} à confirmer` : undefined} />
        <Stat label="Commandes" value={formatNumber(stats.orders_count)} />
        <Stat label="Panier moyen" value={stats.avg_order_value !== null ? formatMoney(stats.avg_order_value, currency) : "—"} />
        <Stat label="Taux de réussite" value={successRate !== null ? `${successRate} %` : "—"} hint={`${stats.delivered_count} livrées · ${stats.failed_count} échecs`} />
      </StatStrip>

      {!hasActivity ? (
        <Panel>
          <EmptyState title="Aucune activité sur la période" description="Les graphiques s'afficheront dès les premières commandes et livraisons. Aucune donnée n'est simulée." />
        </Panel>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel>
            <PanelHeader title="Commandes par jour" description="Date de création" />
            <PanelBody>
              <BarChart title="Commandes par jour" data={days.map((d) => ({ key: d.key, label: d.label, fullLabel: d.fullLabel, values: { orders: d.orders } }))} series={[{ key: "orders", label: "Commandes", color: "#2563EB" }]} />
            </PanelBody>
          </Panel>
          <Panel>
            <PanelHeader title="Chiffre d'affaires livré par jour" description="Date de livraison" />
            <PanelBody>
              <BarChart
                title="Chiffre d'affaires livré par jour"
                data={days.map((d) => ({ key: d.key, label: d.label, fullLabel: d.fullLabel, values: { revenue: d.revenue } }))}
                series={[{ key: "revenue", label: "Chiffre d'affaires", color: "#2563EB" }]}
                format={{ kind: "money", currency }}
              />
            </PanelBody>
          </Panel>
          <Panel className="lg:col-span-2">
            <PanelHeader title="Livraisons terminées par jour" />
            <PanelBody>
              <BarChart
                title="Livraisons réussies et échouées par jour"
                height={200}
                data={days.map((d) => ({ key: d.key, label: d.label, fullLabel: d.fullLabel, values: { delivered: d.delivered, failed: d.failed } }))}
                series={[
                  { key: "delivered", label: "Livrées", color: "#15803D" },
                  { key: "failed", label: "Échecs", color: "#DC2626" },
                ]}
              />
            </PanelBody>
          </Panel>
          <Panel>
            <PanelHeader title="Origine des commandes" />
            <PanelBody>{bySource.length ? <BarList items={bySource} /> : <p className="text-[13px] text-ink-3">Aucune commande.</p>}</PanelBody>
          </Panel>
          <Panel>
            <PanelHeader title="Encaissements confirmés par moyen" />
            <PanelBody>{byMethod.length ? <BarList items={byMethod} format={{ kind: "money", currency }} /> : <p className="text-[13px] text-ink-3">Aucun encaissement confirmé.</p>}</PanelBody>
          </Panel>
          <Panel>
            <PanelHeader title="Produits les plus vendus" />
            {top.data?.length ? (
              <TableWrap>
                <Table>
                  <THead>
                    <tr>
                      <TH>Produit</TH>
                      <TH align="right">Quantité</TH>
                      <TH align="right">Montant</TH>
                    </tr>
                  </THead>
                  <tbody>
                    {top.data.map((p) => (
                      <TR key={p.product_name}>
                        <TD className="max-w-[220px] truncate">{p.product_name}</TD>
                        <TD align="right">{p.quantity_sold}</TD>
                        <TD align="right">{formatMoney(p.revenue_amount, currency)}</TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            ) : (
              <p className="px-5 py-4 text-[13px] text-ink-3">Aucune vente.</p>
            )}
          </Panel>
          <Panel>
            <PanelHeader title="Performance des livreurs" description="Durée moyenne : acceptation → livraison" />
            {perf.data?.length ? (
              <TableWrap>
                <Table>
                  <THead>
                    <tr>
                      <TH>Livreur</TH>
                      <TH align="right">Livrées</TH>
                      <TH align="right">Échecs</TH>
                      <TH align="right">Durée moy.</TH>
                    </tr>
                  </THead>
                  <tbody>
                    {perf.data.map((c) => (
                      <TR key={c.courier_id}>
                        <TD>{c.courier_name}</TD>
                        <TD align="right">{c.delivered_count}</TD>
                        <TD align="right">{c.failed_count}</TD>
                        <TD align="right">{c.avg_delivery_minutes !== null ? `${c.avg_delivery_minutes} min` : "—"}</TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            ) : (
              <p className="px-5 py-4 text-[13px] text-ink-3">Aucune course terminée.</p>
            )}
          </Panel>
        </div>
      )}
    </PageContainer>
  );
}
