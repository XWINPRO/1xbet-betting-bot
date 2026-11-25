import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { ORDER_SOURCE, ORDER_STATUS, PAYMENT_STATUS } from "@/lib/status";
import { pageNumber, sanitizeSearch } from "@/lib/search";
import { param } from "@/lib/utils";
import { EmptyState, PageContainer, PageHeader } from "@/components/ui/page";
import { Panel } from "@/components/ui/panel";
import { ParamSelect, SearchInput } from "@/components/ui/client-helpers";
import { StatusBadge, Tag } from "@/components/ui/badge";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import Link from "next/link";
import type { OrderStatus } from "@/types/domain";

export const metadata = { title: "Commandes" };
const PAGE = 30;

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = sanitizeSearch(param(sp.q));
  const status = param(sp.status);
  const page = pageNumber(param(sp.page));
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("orders")
    .select("id, reference, customer_name, customer_phone, status, source, total, currency, payment_status, created_at, current_job_id, stores(name, slug)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (status && status in ORDER_STATUS) query = query.eq("status", status as OrderStatus);
  if (q) query = query.or(`reference.ilike.%${q}%,customer_name.ilike.%${q}%,customer_phone.ilike.%${q.replace(/\s/g, "")}%`);
  const { data: orders, count } = await query;

  return (
    <PageContainer>
      <PageHeader title="Commandes" description="Toutes les commandes des boutiques (lecture). Les modifications se font par la boutique." />
      <Panel>
        <div className="flex flex-wrap justify-end gap-2 border-b border-line px-5 py-2.5">
          <ParamSelect param="status" label="Statut" options={[{ value: "", label: "Tous statuts" }, ...Object.entries(ORDER_STATUS).map(([value, m]) => ({ value, label: m.label }))]} />
          <SearchInput placeholder="Référence, client, téléphone" />
        </div>
        {!orders?.length ? (
          <EmptyState title="Aucune commande" />
        ) : (
          <>
            <TableWrap>
              <Table>
                <THead>
                  <tr>
                    <TH>Commande</TH>
                    <TH>Boutique</TH>
                    <TH className="hidden md:table-cell">Client</TH>
                    <TH>Statut</TH>
                    <TH className="hidden lg:table-cell">Paiement</TH>
                    <TH align="right">Total</TH>
                  </tr>
                </THead>
                <tbody>
                  {orders.map((o) => (
                    <TR key={o.id}>
                      <TD>
                        <p className="font-medium">{o.reference}</p>
                        <p className="flex items-center gap-1.5 text-xs text-ink-3">
                          <Tag>{ORDER_SOURCE[o.source]}</Tag> {formatDateTime(o.created_at)}
                        </p>
                        {o.current_job_id ? (
                          <Link href={`/admin/deliveries/${o.current_job_id}`} className="text-xs text-accent hover:underline">
                            Voir la course
                          </Link>
                        ) : null}
                      </TD>
                      <TD>{o.stores?.name}</TD>
                      <TD className="hidden md:table-cell">
                        <p>{o.customer_name}</p>
                        <p className="text-xs text-ink-3">{formatPhone(o.customer_phone)}</p>
                      </TD>
                      <TD>
                        <StatusBadge map={ORDER_STATUS} value={o.status} />
                      </TD>
                      <TD className="hidden lg:table-cell">
                        <StatusBadge map={PAYMENT_STATUS} value={o.payment_status} />
                      </TD>
                      <TD align="right">{formatMoney(o.total, o.currency)}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
            <Pagination
              page={page}
              pageSize={PAGE}
              total={count ?? 0}
              makeHref={(n) => `/admin/orders?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), page: String(n) })}`}
            />
          </>
        )}
      </Panel>
    </PageContainer>
  );
}
