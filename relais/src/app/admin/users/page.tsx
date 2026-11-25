import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { setPlatformAdminAction, setUserSuspensionAction } from "@/lib/actions/admin";
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

export const metadata = { title: "Utilisateurs" };
const PAGE = 30;

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireAdmin();
  const sp = await searchParams;
  const q = sanitizeSearch(param(sp.q));
  const page = pageNumber(param(sp.page));
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("profiles").select("*", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q.replace(/\s/g, "")}%`);
  const { data: users, count } = await query;
  const ids = (users ?? []).map((u) => u.id);
  const [{ data: members }, { data: couriers }] = ids.length
    ? await Promise.all([
        supabase.from("store_members").select("user_id, role, stores(name)").in("user_id", ids),
        supabase.from("couriers").select("user_id, kind, account_status").in("user_id", ids),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <PageContainer>
      <PageHeader title="Utilisateurs" description="Comptes de la plateforme. La suspension bloque l'accès à tous les espaces." />
      <Panel>
        <div className="flex justify-end border-b border-line px-5 py-2.5">
          <SearchInput placeholder="Nom, e-mail, téléphone" />
        </div>
        {!users?.length ? (
          <EmptyState title="Aucun utilisateur" />
        ) : (
          <>
            <TableWrap>
              <Table>
                <THead>
                  <tr>
                    <TH>Utilisateur</TH>
                    <TH>Rôles</TH>
                    <TH className="hidden md:table-cell">Inscription</TH>
                    <TH>Statut</TH>
                    <TH align="right">Actions</TH>
                  </tr>
                </THead>
                <tbody>
                  {users.map((u) => {
                    const m = (members ?? []).filter((x) => x.user_id === u.id);
                    const c = (couriers ?? []).find((x) => x.user_id === u.id);
                    const self = u.id === viewer.id;
                    return (
                      <TR key={u.id}>
                        <TD>
                          <p className="font-medium">{u.full_name || "—"}</p>
                          <p className="text-xs text-ink-3">
                            {u.email}
                            {u.phone ? ` · ${formatPhone(u.phone)}` : ""}
                          </p>
                        </TD>
                        <TD>
                          <div className="flex flex-wrap gap-1">
                            {u.is_platform_admin ? <Badge tone="accent" dot={false}>Admin</Badge> : null}
                            {m.map((x, i) => (
                              <Badge key={i} tone="neutral" dot={false}>
                                {x.role === "owner" ? "Propriétaire" : "Équipe"} · {x.stores?.name}
                              </Badge>
                            ))}
                            {c ? <Badge tone="neutral" dot={false}>{c.kind === "platform" ? "Livreur réseau" : "Livreur boutique"}</Badge> : null}
                            {!u.is_platform_admin && !m.length && !c ? <span className="text-xs text-ink-4">Client</span> : null}
                          </div>
                        </TD>
                        <TD className="hidden text-ink-3 md:table-cell">{formatDate(u.created_at)}</TD>
                        <TD>{u.is_suspended ? <Badge tone="danger">Suspendu</Badge> : <Badge tone="success">Actif</Badge>}</TD>
                        <TD align="right">
                          {self ? (
                            <span className="text-xs text-ink-4">Vous</span>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <ConfirmAction
                                label={u.is_platform_admin ? "Retirer admin" : "Rendre admin"}
                                title={u.is_platform_admin ? "Retirer les droits administrateur" : "Accorder les droits administrateur"}
                                description="L'administrateur a accès à toutes les données de la plateforme."
                                confirmLabel="Confirmer"
                                variant="ghost"
                                action={setPlatformAdminAction.bind(null, u.id, !u.is_platform_admin)}
                              />
                              <ConfirmAction
                                label={u.is_suspended ? "Réactiver" : "Suspendre"}
                                title={u.is_suspended ? "Réactiver le compte" : "Suspendre le compte"}
                                confirmLabel={u.is_suspended ? "Réactiver" : "Suspendre"}
                                variant={u.is_suspended ? "secondary" : "danger-ghost"}
                                reason={u.is_suspended ? undefined : "required"}
                                action={setUserSuspensionAction.bind(null, u.id, !u.is_suspended)}
                              />
                            </div>
                          )}
                        </TD>
                      </TR>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
            <Pagination page={page} pageSize={PAGE} total={count ?? 0} makeHref={(n) => `/admin/users?page=${n}${q ? `&q=${encodeURIComponent(q)}` : ""}`} />
          </>
        )}
      </Panel>
    </PageContainer>
  );
}
