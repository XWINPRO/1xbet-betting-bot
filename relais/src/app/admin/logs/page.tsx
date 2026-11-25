import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { pageNumber } from "@/lib/search";
import { param } from "@/lib/utils";
import { EmptyState, PageContainer, PageHeader } from "@/components/ui/page";
import { Panel } from "@/components/ui/panel";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";

export const metadata = { title: "Journal d'activité" };
const PAGE = 50;

const ACTIONS: Record<string, string> = {
  "store.created": "Boutique créée",
  "order.created": "Commande créée",
  "delivery.created": "Course créée",
  "delivery.assigned": "Course attribuée",
  "delivery.cancelled": "Course annulée",
  "courier.added": "Livreur ajouté",
  "courier.updated": "Livreur modifié",
  "courier.suspended": "Accès livreur suspendu",
  "courier.reactivated": "Accès livreur réactivé",
  "courier.applied": "Candidature livreur",
  "staff.invited": "Employé invité",
  "staff.permissions_updated": "Permissions modifiées",
  "staff.removed": "Employé retiré",
  "invitation.accepted": "Invitation acceptée",
  "on_demand.created": "Livraison ponctuelle demandée",
  "payment.recorded": "Paiement enregistré",
  "payment.confirmed": "Paiement confirmé",
  "payment.failed": "Paiement rejeté",
  "admin.setting_updated": "Paramètre modifié",
  "admin.user_suspended": "Utilisateur suspendu",
  "admin.user_reactivated": "Utilisateur réactivé",
  "admin.store_suspended": "Boutique suspendue",
  "admin.store_active": "Boutique réactivée",
  "admin.granted": "Droits admin accordés",
  "admin.revoked": "Droits admin retirés",
  "admin.courier_approve": "Livreur validé",
  "admin.courier_reject": "Livreur refusé",
  "admin.courier_suspend": "Livreur suspendu",
  "admin.courier_reactivate": "Livreur réactivé",
};

export default async function AdminLogsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const page = pageNumber(param(sp.page));
  const supabase = await createSupabaseServerClient();
  const { data: logs, count } = await supabase
    .from("activity_logs")
    .select("id, action, entity_type, entity_id, metadata, created_at, actor_id, profiles(full_name, email), stores(name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);

  return (
    <PageContainer>
      <PageHeader title="Journal d'activité" description="Actions sensibles effectuées sur la plateforme." />
      <Panel>
        {!logs?.length ? (
          <EmptyState title="Aucune activité enregistrée" />
        ) : (
          <>
            <TableWrap>
              <Table>
                <THead>
                  <tr>
                    <TH>Date</TH>
                    <TH>Action</TH>
                    <TH>Auteur</TH>
                    <TH className="hidden md:table-cell">Contexte</TH>
                  </tr>
                </THead>
                <tbody>
                  {logs.map((l) => (
                    <TR key={l.id}>
                      <TD className="whitespace-nowrap text-ink-3">{formatDateTime(l.created_at)}</TD>
                      <TD>{ACTIONS[l.action] ?? l.action}</TD>
                      <TD>{l.profiles?.full_name || l.profiles?.email || <span className="text-ink-4">Visiteur / système</span>}</TD>
                      <TD className="hidden max-w-[360px] truncate font-mono text-xs text-ink-3 md:table-cell">
                        {l.stores?.name ? `${l.stores.name} · ` : ""}
                        {Object.entries((l.metadata as Record<string, unknown>) ?? {})
                          .filter(([, v]) => v !== null && v !== "")
                          .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
                          .join(" ")}
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
            <Pagination page={page} pageSize={PAGE} total={count ?? 0} makeHref={(n) => `/admin/logs?page=${n}`} />
          </>
        )}
      </Panel>
    </PageContainer>
  );
}
