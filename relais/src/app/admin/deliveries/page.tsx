import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney } from "@/lib/format";
import { JOB_STATUS } from "@/lib/status";
import { pageNumber, sanitizeSearch } from "@/lib/search";
import { param } from "@/lib/utils";
import { EmptyState, PageContainer, PageHeader } from "@/components/ui/page";
import { Panel } from "@/components/ui/panel";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { ParamSelect, SearchInput } from "@/components/ui/client-helpers";
import { StatusBadge, Tag } from "@/components/ui/badge";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { RealtimeRefresher } from "@/components/realtime/realtime-refresher";
import type { JobStatus } from "@/types/domain";

export const metadata = { title: "Courses" };
const PAGE = 30;
const TABS: { key: string; label: string; statuses: JobStatus[] | null }[] = [
  { key: "active", label: "En cours", statuses: ["offered", "accepted", "picked_up", "in_transit"] },
  { key: "pending", label: "Sans livreur", statuses: ["pending"] },
  { key: "done", label: "Livrées", statuses: ["delivered"] },
  { key: "issues", label: "Échecs et annulations", statuses: ["failed", "cancelled"] },
  { key: "all", label: "Toutes", statuses: null },
];

export default async function AdminDeliveriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === param(sp.tab)) ?? TABS[4];
  const source = param(sp.source);
  const q = sanitizeSearch(param(sp.q));
  const page = pageNumber(param(sp.page));
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("delivery_jobs")
    .select("id, reference, source, status, requester_name, pickup_address, dropoff_name, dropoff_address, price, currency, created_at, stores(name), couriers(full_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (tab.statuses) query = query.in("status", tab.statuses);
  if (source === "on_demand" || source === "store_order") query = query.eq("source", source);
  if (q) query = query.or(`reference.ilike.%${q}%,requester_name.ilike.%${q}%,requester_phone.ilike.%${q}%,dropoff_name.ilike.%${q}%,dropoff_phone.ilike.%${q}%,dropoff_address.ilike.%${q}%`);
  const { data: jobs, count } = await query;
  const href = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ tab: tab.key, source: source ?? null, q, ...patch })) if (v) params.set(k, v);
    return `/admin/deliveries?${params.toString()}`;
  };

  return (
    <PageContainer size="wide">
      <RealtimeRefresher channel="admin-deliveries" tables={["delivery_jobs"]} debounceMs={1500} />
      <PageHeader title="Courses" description="Livraisons des boutiques et livraisons ponctuelles. Recherchez une course pour voir les parties concernées et intervenir." />
      <Panel>
        <div className="flex flex-col gap-3 border-b border-line px-5 pt-2 lg:flex-row lg:items-end lg:justify-between">
          <FilterTabs active={tab.key} items={TABS.map((t) => ({ key: t.key, label: t.label, href: href({ tab: t.key, page: null }) }))} />
          <div className="flex gap-2 pb-2.5">
            <ParamSelect param="source" label="Type" options={[{ value: "", label: "Tous types" }, { value: "on_demand", label: "Ponctuelles" }, { value: "store_order", label: "Boutiques" }]} />
            <SearchInput placeholder="Référence, nom, téléphone, adresse" />
          </div>
        </div>
        {!jobs?.length ? (
          <EmptyState title="Aucune course" />
        ) : (
          <>
            <TableWrap>
              <Table>
                <THead>
                  <tr>
                    <TH>Course</TH>
                    <TH>Origine</TH>
                    <TH className="hidden md:table-cell">Destination</TH>
                    <TH>Livreur</TH>
                    <TH>Statut</TH>
                    <TH align="right" className="hidden lg:table-cell">Prix</TH>
                  </tr>
                </THead>
                <tbody>
                  {jobs.map((j) => (
                    <TR key={j.id}>
                      <TD>
                        <Link href={`/admin/deliveries/${j.id}`} className="font-mono text-[13px] font-medium hover:text-accent">
                          {j.reference}
                        </Link>
                        <p className="text-xs text-ink-3">{formatDateTime(j.created_at)}</p>
                      </TD>
                      <TD>
                        <Tag>{j.source === "on_demand" ? "Ponctuelle" : "Boutique"}</Tag>
                        <p className="mt-0.5 max-w-[180px] truncate text-xs text-ink-3">{j.stores?.name ?? j.requester_name}</p>
                      </TD>
                      <TD className="hidden max-w-[260px] md:table-cell">
                        <p className="truncate">{j.dropoff_name}</p>
                        <p className="truncate text-xs text-ink-3">{j.dropoff_address}</p>
                      </TD>
                      <TD>{j.couriers?.full_name ?? <span className="text-warning-ink">À attribuer</span>}</TD>
                      <TD>
                        <StatusBadge map={JOB_STATUS} value={j.status} />
                      </TD>
                      <TD align="right" className="hidden lg:table-cell">
                        {formatMoney(j.price, j.currency)}
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
            <Pagination page={page} pageSize={PAGE} total={count ?? 0} makeHref={(n) => href({ page: String(n) })} />
          </>
        )}
      </Panel>
    </PageContainer>
  );
}
