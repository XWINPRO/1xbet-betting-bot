import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { getStoreContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatMoney, formatRelative } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { pageNumber, sanitizeSearch } from "@/lib/search";
import { param } from "@/lib/utils";
import { EmptyState, PageContainer, PageHeader } from "@/components/ui/page";
import { Panel } from "@/components/ui/panel";
import { SearchInput } from "@/components/ui/client-helpers";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Avatar } from "@/components/ui/avatar";
import { CustomerDialog } from "@/components/customers/customer-dialog";

export const metadata = { title: "Clients" };
const PAGE_SIZE = 30;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ctx = await getStoreContext();
  if (!(ctx.can("customers.view") || ctx.can("orders.create") || ctx.can("orders.edit"))) redirect("/dashboard?denied=1");
  const supabase = await createSupabaseServerClient();
  const q = sanitizeSearch(param(sp.q));
  const page = pageNumber(param(sp.page));
  const showAmounts = ctx.can("stats.view") || ctx.can("orders.edit");

  let query = supabase
    .from("customers")
    .select("id, full_name, phone, address, created_at", { count: "exact" })
    .eq("store_id", ctx.storeId)
    .order("updated_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q.replace(/\s/g, "")}%,address.ilike.%${q}%`);
  const { data: customers, count, error } = await query;
  if (error) throw error;

  const ids = (customers ?? []).map((c) => c.id);
  const { data: orders } = ids.length
    ? await supabase.from("orders").select("customer_id, total, status, created_at").eq("store_id", ctx.storeId).in("customer_id", ids)
    : { data: [] };
  const agg = new Map<string, { count: number; spent: number; last: string | null }>();
  for (const o of orders ?? []) {
    if (!o.customer_id) continue;
    const a = agg.get(o.customer_id) ?? { count: 0, spent: 0, last: null };
    a.count += 1;
    if (o.status === "delivered") a.spent += Number(o.total);
    if (!a.last || o.created_at > a.last) a.last = o.created_at;
    agg.set(o.customer_id, a);
  }

  return (
    <PageContainer>
      <PageHeader title="Clients" description="Chaque commande enregistre ou met à jour la fiche du client (par numéro de téléphone)." actions={<CustomerDialog mode="create" />} />
      <Panel>
        <div className="flex justify-end border-b border-line px-5 py-2.5">
          <SearchInput placeholder="Nom, téléphone, adresse" />
        </div>
        {!customers?.length ? (
          <EmptyState
            icon={<Users />}
            title={q ? "Aucun client trouvé" : "Aucun client pour l'instant"}
            description={q ? "Essayez un autre nom ou numéro." : "Vos clients sont ajoutés automatiquement à chaque commande."}
          />
        ) : (
          <>
            <TableWrap>
              <Table>
                <THead>
                  <tr>
                    <TH>Client</TH>
                    <TH className="hidden md:table-cell">Adresse</TH>
                    <TH align="right">Commandes</TH>
                    {showAmounts ? <TH align="right" className="hidden sm:table-cell">Total livré</TH> : null}
                    <TH className="hidden lg:table-cell">Dernière commande</TH>
                  </tr>
                </THead>
                <tbody>
                  {customers.map((c) => {
                    const a = agg.get(c.id);
                    return (
                      <TR key={c.id}>
                        <TD>
                          <Link href={`/dashboard/customers/${c.id}`} className="flex items-center gap-3">
                            <Avatar name={c.full_name} size={30} />
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-ink hover:text-accent">{c.full_name}</span>
                              <span className="text-xs text-ink-3 tabular">{formatPhone(c.phone)}</span>
                            </span>
                          </Link>
                        </TD>
                        <TD className="hidden max-w-[260px] truncate text-ink-2 md:table-cell">{c.address ?? <span className="text-ink-4">—</span>}</TD>
                        <TD align="right">{a?.count ?? 0}</TD>
                        {showAmounts ? (
                          <TD align="right" className="hidden sm:table-cell">
                            {formatMoney(a?.spent ?? 0, ctx.store.currency)}
                          </TD>
                        ) : null}
                        <TD className="hidden text-ink-3 lg:table-cell">{a?.last ? formatRelative(a.last) : "—"}</TD>
                      </TR>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
            <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} makeHref={(n) => `/dashboard/customers?${new URLSearchParams({ ...(q ? { q } : {}), page: String(n) })}`} />
          </>
        )}
      </Panel>
    </PageContainer>
  );
}
