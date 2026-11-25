import { getI18n } from "@/i18n/server";
import { msg } from "@/i18n/msg";
import type { Metadata } from "next";
import Link from "next/link";
import { Inbox, Plus } from "lucide-react";
import { getStoreContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPhone } from "@/lib/phone";
import { ORDER_SOURCE, ORDER_STATUS, PAYMENT_STATUS, JOB_STATUS } from "@/lib/status";
import { pageNumber, sanitizeSearch } from "@/lib/search";
import { param } from "@/lib/utils";
import { EmptyState, PageContainer, PageHeader } from "@/components/ui/page";
import { Panel } from "@/components/ui/panel";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { ParamSelect, SearchInput } from "@/components/ui/client-helpers";
import { StatusBadge, Tag } from "@/components/ui/badge";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { RealtimeRefresher } from "@/components/realtime/realtime-refresher";
import type { OrderStatus } from "@/types/domain";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Commandes") };
}

const PAGE_SIZE = 25;

const GROUPS: { key: string; label: string; statuses: OrderStatus[] | null }[] = [
  { key: "all", label: msg("Toutes"), statuses: null },
  { key: "open", label: msg("À traiter"), statuses: ["new", "confirmed", "preparing", "ready_for_pickup"] },
  { key: "new", label: msg("Nouvelles"), statuses: ["new"] },
  { key: "shipping", label: msg("En livraison"), statuses: ["handed_to_courier", "in_transit"] },
  { key: "delivered", label: msg("Livrées"), statuses: ["delivered"] },
  { key: "issues", label: msg("Échecs"), statuses: ["delivery_failed"] },
  { key: "cancelled", label: msg("Annulées"), statuses: ["cancelled"] },
];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ctx = await getStoreContext();
  const { t, f } = await getI18n();
  const supabase = await createSupabaseServerClient();
  const group = GROUPS.find((g) => g.key === param(sp.status)) ?? GROUPS[0];
  const q = sanitizeSearch(param(sp.q));
  const source = param(sp.source);
  const page = pageNumber(param(sp.page));
  const showAmounts = ctx.can("stats.view") || ctx.can("orders.edit");

  let query = supabase
    .from("orders")
    .select(
      "id, reference, customer_name, customer_phone, status, source, delivery_mode, total, currency, payment_status, payment_method, created_at, delivery_jobs!delivery_jobs_order_id_fkey(id, status, couriers(full_name))",
      { count: "exact" },
    )
    .eq("store_id", ctx.storeId)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (group.statuses) query = query.in("status", group.statuses);
  if (source && source in ORDER_SOURCE) query = query.eq("source", source as keyof typeof ORDER_SOURCE);
  if (q) query = query.or(`reference.ilike.%${q}%,customer_name.ilike.%${q}%,customer_phone.ilike.%${q.replace(/\s/g, "")}%`);

  const [{ data: orders, count, error }, counts] = await Promise.all([
    query,
    supabase.from("orders").select("status").eq("store_id", ctx.storeId).in("status", ["new", "confirmed", "preparing", "ready_for_pickup"]),
  ]);
  if (error) throw error;

  const openCount = counts.data?.length ?? 0;
  const newCount = counts.data?.filter((o) => o.status === "new").length ?? 0;

  const hrefWith = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams();
    const base: Record<string, string | undefined> = { status: group.key === "all" ? undefined : group.key, q: q ?? undefined, source };
    for (const [k, v] of Object.entries({ ...base, ...patch })) if (v) params.set(k, v);
    const s = params.toString();
    return `/dashboard/orders${s ? `?${s}` : ""}`;
  };

  return (
    <PageContainer>
      <RealtimeRefresher channel={`orders-${ctx.storeId}`} tables={["orders"]} filter={`store_id=eq.${ctx.storeId}`} />
      <PageHeader
        title={t("Commandes")}
        description={t("Boutique en ligne, WhatsApp, téléphone : toutes vos commandes au même endroit.")}
        actions={
          ctx.can("orders.create") ? (
            <Button asChild variant="primary">
              <Link href="/dashboard/orders/new">
                <Plus /> {t("Nouvelle commande")}
              </Link>
            </Button>
          ) : null
        }
      />
      <Panel>
        <div className="flex flex-col gap-3 border-b border-line px-5 pt-2 lg:flex-row lg:items-end lg:justify-between">
          <FilterTabs
            active={group.key}
            items={GROUPS.map((g) => ({
              key: g.key,
              label: t(g.label),
              href: hrefWith({ status: g.key === "all" ? null : g.key, page: null }),
              count: g.key === "open" ? openCount : g.key === "new" ? newCount : undefined,
            }))}
          />
          <div className="flex gap-2 pb-2.5">
            <ParamSelect
              param="source"
              label={t("Origine")}
              options={[{ value: "", label: t("Toutes origines") }, ...Object.entries(ORDER_SOURCE).map(([value, label]) => ({ value, label: t(label) }))]}
            />
            <SearchInput placeholder={t("Référence, client, téléphone")} />
          </div>
        </div>
        {!orders || orders.length === 0 ? (
          <EmptyState
            icon={<Inbox />}
            title={q || source || group.statuses ? t("Aucune commande ne correspond") : t("Aucune commande")}
            description={
              q || source || group.statuses
                ? t("Modifiez les filtres ou la recherche.")
                : t("Saisissez les commandes reçues par WhatsApp ou téléphone, ou partagez votre boutique en ligne.")
            }
            action={
              !q && !group.statuses && ctx.can("orders.create") ? (
                <Button asChild variant="primary">
                  <Link href="/dashboard/orders/new">{t("Saisir une commande")}</Link>
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <TableWrap>
              <Table>
                <THead>
                  <tr>
                    <TH>{t("Commande")}</TH>
                    <TH>{t("Client")}</TH>
                    <TH>{t("Statut")}</TH>
                    <TH className="hidden lg:table-cell">{t("Livraison")}</TH>
                    <TH className="hidden md:table-cell">{t("Paiement")}</TH>
                    <TH align="right">{t("Total")}</TH>
                  </tr>
                </THead>
                <tbody>
                  {orders.map((o) => {
                    const job = [...(o.delivery_jobs ?? [])].sort((a, b) => (a.status === "cancelled" ? 1 : 0) - (b.status === "cancelled" ? 1 : 0))[0];
                    return (
                      <TR key={o.id} className="group">
                        <TD>
                          <Link href={`/dashboard/orders/${o.id}`} className="font-medium text-ink group-hover:text-accent">
                            {o.reference}
                          </Link>
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
                            <Tag>{t(ORDER_SOURCE[o.source])}</Tag>
                            <span title={f.dateTime(o.created_at)}>{f.relative(o.created_at)}</span>
                          </div>
                        </TD>
                        <TD>
                          <div className="max-w-[200px] truncate">{o.customer_name}</div>
                          <div className="text-xs text-ink-3 tabular">{formatPhone(o.customer_phone)}</div>
                        </TD>
                        <TD>
                          <StatusBadge map={ORDER_STATUS} value={o.status} />
                        </TD>
                        <TD className="hidden lg:table-cell">
                          {o.delivery_mode === "pickup" ? (
                            <span className="text-xs text-ink-3">{t("Retrait en boutique")}</span>
                          ) : job ? (
                            <div className="flex flex-col items-start gap-0.5">
                              <StatusBadge map={JOB_STATUS} value={job.status} />
                              <span className="text-xs text-ink-3">{job.couriers?.full_name ?? t("Sans livreur")}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-ink-3">{t("Non planifiée")}</span>
                          )}
                        </TD>
                        <TD className="hidden md:table-cell">
                          <StatusBadge map={PAYMENT_STATUS} value={o.payment_status} />
                        </TD>
                        <TD align="right" className="font-medium">
                          {showAmounts ? f.money(o.total, o.currency) : "—"}
                        </TD>
                      </TR>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
            <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} makeHref={(p) => hrefWith({ page: String(p) })} />
          </>
        )}
      </Panel>
    </PageContainer>
  );
}
