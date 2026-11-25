import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reviewCourierAction } from "@/lib/actions/admin";
import { COURIER_ACCOUNT, COURIER_STATUS, VEHICLES } from "@/lib/status";
import { formatDate, formatRelative } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { param } from "@/lib/utils";
import { EmptyState, PageContainer, PageHeader } from "@/components/ui/page";
import { Panel } from "@/components/ui/panel";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { StatusBadge, Tag } from "@/components/ui/badge";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { DocumentButton } from "@/components/admin/document-button";
import type { AdminBoardCourier, EffectiveCourierStatus } from "@/types/domain";

export const metadata = { title: "Livreurs" };

export default async function AdminCouriersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const tab = param(sp.tab) ?? "platform";
  const supabase = await createSupabaseServerClient();
  const [{ data: board }, { data: details }] = await Promise.all([
    supabase.rpc("admin_courier_board", {}),
    supabase.from("couriers").select("id, vehicle_plate, id_document_path, review_note"),
  ]);
  const all = (board ?? []) as AdminBoardCourier[];
  const extra = new Map((details ?? []).map((d) => [d.id, d]));
  const list = all.filter((c) =>
    tab === "review" ? c.account_status === "pending_review" : tab === "private" ? c.kind === "private" : tab === "all" ? true : c.kind === "platform" && c.account_status !== "pending_review",
  );
  const pendingCount = all.filter((c) => c.account_status === "pending_review").length;

  return (
    <PageContainer size="wide">
      <PageHeader title="Livreurs" description="Validation des livreurs du réseau, suspension et suivi de la disponibilité réelle." />
      <Panel>
        <div className="border-b border-line px-5 pt-2">
          <FilterTabs
            active={tab}
            items={[
              { key: "review", label: "À valider", href: "/admin/couriers?tab=review", count: pendingCount },
              { key: "platform", label: "Réseau", href: "/admin/couriers?tab=platform" },
              { key: "private", label: "Livreurs de boutiques", href: "/admin/couriers?tab=private" },
              { key: "all", label: "Tous", href: "/admin/couriers?tab=all" },
            ]}
          />
        </div>
        {!list.length ? (
          <EmptyState title={tab === "review" ? "Aucune candidature en attente" : "Aucun livreur"} />
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Livreur</TH>
                  <TH>Compte</TH>
                  <TH>Disponibilité</TH>
                  <TH className="hidden lg:table-cell">Activité</TH>
                  <TH align="right">Actions</TH>
                </tr>
              </THead>
              <tbody>
                {list.map((c) => {
                  const d = extra.get(c.courier_id);
                  return (
                    <TR key={c.courier_id}>
                      <TD>
                        <p className="font-medium">{c.full_name}</p>
                        <p className="text-xs text-ink-3">
                          {formatPhone(c.phone)}
                          {c.vehicle_type ? ` · ${VEHICLES[c.vehicle_type] ?? c.vehicle_type}` : ""}
                          {d?.vehicle_plate ? ` · ${d.vehicle_plate}` : ""}
                        </p>
                        {c.zone ? <p className="text-xs text-ink-3">{c.zone}</p> : null}
                      </TD>
                      <TD>
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge map={COURIER_ACCOUNT} value={c.account_status} />
                          <Tag>{c.kind === "platform" ? "Réseau" : `${c.stores_count} boutique(s)`}</Tag>
                          {d?.review_note ? <span className="max-w-[220px] text-xs text-ink-3">{d.review_note}</span> : null}
                        </div>
                      </TD>
                      <TD>
                        <StatusBadge map={COURIER_STATUS} value={c.effective_status as EffectiveCourierStatus} />
                        <p className="mt-0.5 text-xs text-ink-3">{c.last_seen_at ? `signal ${formatRelative(c.last_seen_at)}` : "jamais connecté"}</p>
                      </TD>
                      <TD className="hidden text-ink-3 lg:table-cell">
                        {c.active_jobs} en cours · {c.delivered_total} livrées
                        <p className="text-xs">inscrit le {formatDate(c.created_at)}</p>
                      </TD>
                      <TD align="right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {d?.id_document_path ? <DocumentButton path={d.id_document_path} /> : null}
                          {c.account_status === "pending_review" || c.account_status === "rejected" ? (
                            <ConfirmAction label="Valider" title="Valider ce livreur" confirmLabel="Valider" variant="success" reason="optional" action={reviewCourierAction.bind(null, c.courier_id, "approve")} />
                          ) : null}
                          {c.account_status === "pending_review" ? (
                            <ConfirmAction label="Refuser" title="Refuser la candidature" description="Le livreur verra le motif et pourra corriger son profil." confirmLabel="Refuser" variant="danger-ghost" reason="required" action={reviewCourierAction.bind(null, c.courier_id, "reject")} />
                          ) : null}
                          {c.account_status === "active" ? (
                            <ConfirmAction label="Suspendre" title="Suspendre ce livreur" description="Ses propositions en attente sont retirées." confirmLabel="Suspendre" variant="danger-ghost" reason="required" action={reviewCourierAction.bind(null, c.courier_id, "suspend")} />
                          ) : null}
                          {c.account_status === "suspended" ? (
                            <ConfirmAction label="Réactiver" title="Réactiver ce livreur" confirmLabel="Réactiver" reason="optional" action={reviewCourierAction.bind(null, c.courier_id, "reactivate")} />
                          ) : null}
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Panel>
    </PageContainer>
  );
}
