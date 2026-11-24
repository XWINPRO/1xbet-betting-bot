import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { getStoreContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, formatMoney, formatRelative } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/status";
import { whatsappUrl } from "@/lib/whatsapp";
import { EmptyState, PageContainer, PageHeader, Stat, StatStrip } from "@/components/ui/page";
import { Panel, PanelHeader, DescriptionList } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { CustomerDialog } from "@/components/customers/customer-dialog";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";

export const metadata = { title: "Client" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getStoreContext();
  const supabase = await createSupabaseServerClient();
  const [{ data: c }, { data: orders }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).eq("store_id", ctx.storeId).maybeSingle(),
    supabase.from("orders").select("id, reference, status, payment_status, total, currency, created_at").eq("customer_id", id).eq("store_id", ctx.storeId).order("created_at", { ascending: false }).limit(100),
  ]);
  if (!c) notFound();
  const showAmounts = ctx.can("stats.view") || ctx.can("orders.edit");
  const delivered = (orders ?? []).filter((o) => o.status === "delivered");
  const spent = delivered.reduce((s, o) => s + Number(o.total), 0);

  return (
    <PageContainer>
      <PageHeader
        back={{ href: "/dashboard/customers", label: "Clients" }}
        title={c.full_name}
        description={`Client depuis le ${formatDate(c.created_at)}`}
        actions={
          <>
            <WhatsAppButton href={whatsappUrl(c.whatsapp ?? c.phone)} label="WhatsApp" />
            <CustomerDialog
              mode="edit"
              initial={{ id: c.id, full_name: c.full_name, phone: c.phone, whatsapp: c.whatsapp ?? "", email: c.email ?? "", address: c.address ?? "", lat: c.lat, lng: c.lng, notes: c.notes ?? "" }}
            />
            {ctx.can("orders.create") ? (
              <Button asChild variant="primary">
                <Link href={`/dashboard/orders/new?customer=${c.id}`}>
                  <Plus /> Nouvelle commande
                </Link>
              </Button>
            ) : null}
          </>
        }
      />
      <StatStrip className="mb-6">
        <Stat label="Commandes" value={orders?.length ?? 0} />
        <Stat label="Livrées" value={delivered.length} />
        {showAmounts ? <Stat label="Total livré" value={formatMoney(spent, ctx.store.currency)} /> : null}
        <Stat label="Dernière commande" value={orders?.[0] ? formatRelative(orders[0].created_at) : "—"} />
      </StatStrip>
      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Panel className="self-start">
          <PanelHeader title="Coordonnées" />
          <div className="px-5 py-2">
            <DescriptionList
              items={[
                { label: "Téléphone", value: formatPhone(c.phone) },
                { label: "WhatsApp", value: c.whatsapp ? formatPhone(c.whatsapp) : "—" },
                { label: "E-mail", value: c.email ?? "—" },
                { label: "Adresse", value: c.address ?? "—" },
                { label: "Position GPS", value: c.lat != null ? "Enregistrée" : "—" },
                { label: "Notes", value: c.notes ?? "—" },
              ]}
            />
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Historique des commandes" />
          {!orders?.length ? (
            <EmptyState compact title="Aucune commande" />
          ) : (
            <TableWrap>
              <Table>
                <THead>
                  <tr>
                    <TH>Commande</TH>
                    <TH>Statut</TH>
                    <TH className="hidden sm:table-cell">Paiement</TH>
                    <TH align="right">Total</TH>
                  </tr>
                </THead>
                <tbody>
                  {orders.map((o) => (
                    <TR key={o.id}>
                      <TD>
                        <Link href={`/dashboard/orders/${o.id}`} className="font-medium hover:text-accent">
                          {o.reference}
                        </Link>
                        <div className="text-xs text-ink-3">{formatDate(o.created_at)}</div>
                      </TD>
                      <TD>
                        <StatusBadge map={ORDER_STATUS} value={o.status} />
                      </TD>
                      <TD className="hidden sm:table-cell">
                        <StatusBadge map={PAYMENT_STATUS} value={o.payment_status} />
                      </TD>
                      <TD align="right">{showAmounts ? formatMoney(o.total, o.currency) : "—"}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Panel>
      </div>
    </PageContainer>
  );
}
