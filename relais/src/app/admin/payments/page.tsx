import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney } from "@/lib/format";
import { PAYMENT_METHOD, TRANSACTION_STATUS } from "@/lib/status";
import { pageNumber } from "@/lib/search";
import { param } from "@/lib/utils";
import { EmptyState, Notice, PageContainer, PageHeader } from "@/components/ui/page";
import { Panel } from "@/components/ui/panel";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { TransactionActions } from "@/components/admin/tx-actions";
import type { TransactionStatus } from "@/types/domain";

export const metadata = { title: "Paiements" };
const PAGE = 30;

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const tab = param(sp.tab) ?? "pending";
  const page = pageNumber(param(sp.page));
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("transactions")
    .select("id, amount, currency, method, provider, provider_reference, status, notes, created_at, confirmed_at, job_id, order_id, stores(name), orders(reference), delivery_jobs(reference)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (tab !== "all") query = query.eq("status", tab as TransactionStatus);
  const { data: txs, count } = await query;

  return (
    <PageContainer>
      <PageHeader title="Paiements" description="Historique des transactions enregistrées sur la plateforme." />
      <Notice tone="neutral" className="mb-5">
        Aucun prestataire de paiement n&apos;est connecté : les paiements sont à la livraison ou manuels (Mobile Money vérifié à réception). Aucune transaction n&apos;est simulée.
      </Notice>
      <Panel>
        <div className="border-b border-line px-5 pt-2">
          <FilterTabs
            active={tab}
            items={[
              { key: "pending", label: "À confirmer", href: "/admin/payments?tab=pending" },
              { key: "confirmed", label: "Confirmées", href: "/admin/payments?tab=confirmed" },
              { key: "failed", label: "Rejetées", href: "/admin/payments?tab=failed" },
              { key: "all", label: "Toutes", href: "/admin/payments?tab=all" },
            ]}
          />
        </div>
        {!txs?.length ? (
          <EmptyState title="Aucune transaction" />
        ) : (
          <>
            <TableWrap>
              <Table>
                <THead>
                  <tr>
                    <TH>Date</TH>
                    <TH>Objet</TH>
                    <TH>Moyen</TH>
                    <TH align="right">Montant</TH>
                    <TH>Statut</TH>
                    <TH align="right" />
                  </tr>
                </THead>
                <tbody>
                  {txs.map((t) => (
                    <TR key={t.id}>
                      <TD className="text-ink-3">{formatDateTime(t.created_at)}</TD>
                      <TD>
                        {t.orders?.reference ? <p>Commande {t.orders.reference}</p> : null}
                        {t.job_id ? (
                          <Link href={`/admin/deliveries/${t.job_id}`} className="font-mono text-xs text-accent hover:underline">
                            {t.delivery_jobs?.reference}
                          </Link>
                        ) : null}
                        <p className="text-xs text-ink-3">{t.stores?.name ?? "Livraison ponctuelle"}</p>
                        {t.notes ? <p className="text-xs text-ink-3">{t.notes}</p> : null}
                      </TD>
                      <TD>
                        {PAYMENT_METHOD[t.method]}
                        {t.provider_reference ? <p className="text-xs text-ink-3">réf. {t.provider_reference}</p> : null}
                      </TD>
                      <TD align="right" className="font-medium">
                        {formatMoney(t.amount, t.currency)}
                      </TD>
                      <TD>
                        <StatusBadge map={TRANSACTION_STATUS} value={t.status} />
                      </TD>
                      <TD align="right">{t.status === "pending" ? <TransactionActions id={t.id} /> : null}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
            <Pagination page={page} pageSize={PAGE} total={count ?? 0} makeHref={(n) => `/admin/payments?tab=${tab}&page=${n}`} />
          </>
        )}
      </Panel>
    </PageContainer>
  );
}
