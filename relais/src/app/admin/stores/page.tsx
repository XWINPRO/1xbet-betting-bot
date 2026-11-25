import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { setStoreStatusAction } from "@/lib/actions/admin";
import { formatDate } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { pageNumber, sanitizeSearch } from "@/lib/search";
import { param } from "@/lib/utils";
import { EmptyState, PageContainer, PageHeader } from "@/components/ui/page";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/client-helpers";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmAction } from "@/components/admin/confirm-action";

export const metadata = { title: "Boutiques" };
const PAGE = 30;

export default async function AdminStoresPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = sanitizeSearch(param(sp.q));
  const page = pageNumber(param(sp.page));
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("stores")
    .select("id, name, slug, city, phone, is_published, status, status_reason, created_at, organizations(owner_id, profiles(full_name, email))", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (q) query = query.or(`name.ilike.%${q}%,slug.ilike.%${q}%,city.ilike.%${q}%`);
  const { data: stores, count } = await query;
  const ids = (stores ?? []).map((s) => s.id);
  const { data: orders } = ids.length ? await supabase.from("orders").select("store_id").in("store_id", ids) : { data: [] };
  const orderCount = (id: string) => (orders ?? []).filter((o) => o.store_id === id).length;

  return (
    <PageContainer>
      <PageHeader title="Boutiques" description="Une boutique suspendue disparaît de la page publique et ne peut plus créer de commandes." />
      <Panel>
        <div className="flex justify-end border-b border-line px-5 py-2.5">
          <SearchInput placeholder="Nom, adresse, ville" />
        </div>
        {!stores?.length ? (
          <EmptyState title="Aucune boutique" />
        ) : (
          <>
            <TableWrap>
              <Table>
                <THead>
                  <tr>
                    <TH>Boutique</TH>
                    <TH className="hidden md:table-cell">Propriétaire</TH>
                    <TH align="right">Commandes</TH>
                    <TH>Statut</TH>
                    <TH align="right">Actions</TH>
                  </tr>
                </THead>
                <tbody>
                  {stores.map((s) => (
                    <TR key={s.id}>
                      <TD>
                        <p className="font-medium">{s.name}</p>
                        <p className="text-xs text-ink-3">
                          /shop/{s.slug}
                          {s.city ? ` · ${s.city}` : ""}
                          {s.phone ? ` · ${formatPhone(s.phone)}` : ""}
                        </p>
                      </TD>
                      <TD className="hidden md:table-cell">
                        <p>{s.organizations?.profiles?.full_name ?? "—"}</p>
                        <p className="text-xs text-ink-3">{s.organizations?.profiles?.email}</p>
                      </TD>
                      <TD align="right">{orderCount(s.id)}</TD>
                      <TD>
                        <div className="flex flex-col items-start gap-1">
                          {s.status === "suspended" ? <Badge tone="danger">Suspendue</Badge> : s.is_published ? <Badge tone="success">Publiée</Badge> : <Badge tone="neutral">Non publiée</Badge>}
                          <span className="text-xs text-ink-3">depuis le {formatDate(s.created_at)}</span>
                          {s.status_reason ? <span className="text-xs text-danger-ink">{s.status_reason}</span> : null}
                        </div>
                      </TD>
                      <TD align="right">
                        <div className="flex justify-end gap-1">
                          {s.is_published && s.status === "active" ? (
                            <Link href={`/shop/${s.slug}`} target="_blank" className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-[13px] text-ink-2 hover:bg-muted">
                              Voir <ExternalLink className="size-3.5" />
                            </Link>
                          ) : null}
                          <ConfirmAction
                            label={s.status === "suspended" ? "Réactiver" : "Suspendre"}
                            title={s.status === "suspended" ? "Réactiver la boutique" : "Suspendre la boutique"}
                            confirmLabel={s.status === "suspended" ? "Réactiver" : "Suspendre"}
                            variant={s.status === "suspended" ? "secondary" : "danger-ghost"}
                            reason={s.status === "suspended" ? undefined : "required"}
                            action={setStoreStatusAction.bind(null, s.id, s.status === "suspended" ? "active" : "suspended")}
                          />
                        </div>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
            <Pagination page={page} pageSize={PAGE} total={count ?? 0} makeHref={(n) => `/admin/stores?page=${n}${q ? `&q=${encodeURIComponent(q)}` : ""}`} />
          </>
        )}
      </Panel>
    </PageContainer>
  );
}
