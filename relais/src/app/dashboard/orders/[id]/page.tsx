import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Phone } from "lucide-react";
import { getSiteUrl, getStoreContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney } from "@/lib/format";
import { formatPhone, telHref } from "@/lib/phone";
import { toLatLng, googleMapsDirectionsUrl } from "@/lib/geo";
import { ORDER_SOURCE, ORDER_STATUS } from "@/lib/status";
import { whatsappUrl, waMessages } from "@/lib/whatsapp";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Panel, PanelHeader, DescriptionList } from "@/components/ui/panel";
import { StatusBadge, Tag } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RealtimeRefresher } from "@/components/realtime/realtime-refresher";
import { OrderStatusActions, WhatsAppButton } from "./order-actions";
import { DeliveryPanel, type PanelJob } from "./delivery-panel";
import { PaymentPanel } from "./payment-panel";
import { OrderTimeline } from "./order-timeline";
import { EditOrderDetails, EditOrderItems } from "./edit-order";
import type { BoardCourier, ProductVariant } from "@/types/domain";

export const metadata = { title: "Commande" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getStoreContext();
  const supabase = await createSupabaseServerClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*, order_items(id, product_id, name, variant_id, variant_name, unit_price, quantity, line_total, created_at)")
    .eq("id", id)
    .eq("store_id", ctx.storeId)
    .maybeSingle();
  if (!order) notFound();

  const canEdit = ctx.can("orders.edit");
  const canAssign = ctx.can("couriers.assign");
  const showAmounts = canEdit || ctx.can("stats.view");

  const [jobRes, eventsRes, txRes, storeRes, boardRes, settingsRes, productsRes] = await Promise.all([
    order.current_job_id
      ? supabase
          .from("delivery_jobs")
          .select("*, couriers(id, full_name, phone, last_lat, last_lng, last_accuracy, last_location_at)")
          .eq("id", order.current_job_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("order_events")
      .select("id, type, to_status, message, created_at, actor_id")
      .eq("order_id", id)
      .order("created_at", { ascending: true }),
    canEdit || ctx.can("stats.view")
      ? supabase.from("transactions").select("id, amount, method, status, notes, provider_reference, created_at").eq("order_id", id).order("created_at")
      : Promise.resolve({ data: [] }),
    supabase.from("stores").select("name, lat, lng, address").eq("id", ctx.storeId).single(),
    canAssign ? supabase.rpc("store_courier_board", { p_store_id: ctx.storeId }) : Promise.resolve({ data: [] as BoardCourier[] }),
    supabase.from("platform_settings").select("value").eq("key", "location.stale_after_s").maybeSingle(),
    canEdit && ["new", "confirmed", "preparing"].includes(order.status)
      ? supabase.from("products").select("id, name, price, promo_price, status, track_stock, stock, variants").eq("store_id", ctx.storeId).neq("status", "archived").order("name").limit(1000)
      : Promise.resolve({ data: null }),
  ]);

  const site = await getSiteUrl();
  const job = jobRes.data;
  const staleAfter = Number(settingsRes.data?.value ?? 120);

  // Noms des auteurs des événements (profils visibles par RLS : membres de la boutique).
  const actorIds = [...new Set((eventsRes.data ?? []).map((e) => e.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length ? await supabase.from("profiles").select("id, full_name").in("id", actorIds) : { data: [] };
  const actorName = new Map((actors ?? []).map((a) => [a.id, a.full_name]));

  let proofUrl: string | null = null;
  if (job?.proof_photo_path) {
    const { data } = await supabase.storage.from("delivery-proofs").createSignedUrl(job.proof_photo_path, 600);
    proofUrl = data?.signedUrl ?? null;
  }

  const panelJob: PanelJob | null = job
    ? {
        id: job.id,
        reference: job.reference,
        status: job.status,
        courier_id: job.courier_id,
        courier_name: job.couriers?.full_name ?? null,
        courier_phone: job.couriers?.phone ?? null,
        courier_position:
          job.couriers?.last_lat != null && job.couriers?.last_lng != null && job.couriers.last_location_at
            ? { lat: job.couriers.last_lat, lng: job.couriers.last_lng, accuracy: job.couriers.last_accuracy, at: job.couriers.last_location_at }
            : null,
        tracking_token: job.tracking_token,
        tracking_active: job.tracking_active,
        collect_amount: Number(job.collect_amount),
        pickup: toLatLng(job.pickup_lat, job.pickup_lng),
        pickup_address: job.pickup_address,
        dropoff: toLatLng(job.dropoff_lat, job.dropoff_lng),
        dropoff_address: job.dropoff_address,
        delivered_at: job.delivered_at,
        failed_at: job.failed_at,
        cancelled_at: job.cancelled_at,
        failure_reason: job.failure_reason,
        cancel_reason: job.cancel_reason,
        proof_url: proofUrl,
        proof_note: job.proof_note,
        proof_recipient_name: job.proof_recipient_name,
        cash_collected: job.cash_collected,
      }
    : null;

  const items = [...(order.order_items ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const dropoff = toLatLng(order.delivery_lat, order.delivery_lng);
  const hasActiveJob = Boolean(job && !["delivered", "failed", "cancelled"].includes(job.status));

  const confirmationText = waMessages.orderConfirmation({
    storeName: storeRes.data?.name ?? ctx.store.name,
    customerName: order.customer_name,
    reference: order.reference,
    items: items.map((i) => ({ name: i.name, quantity: i.quantity, variant: i.variant_name, total: i.line_total })),
    total: order.total,
    currency: order.currency,
    deliveryAddress: order.delivery_mode === "delivery" ? order.delivery_address : null,
  });

  return (
    <PageContainer>
      <RealtimeRefresher channel={`order-${id}`} tables={["orders", "delivery_jobs"]} filter={`id=eq.${id}`} />
      {job ? <RealtimeRefresher channel={`order-job-${job.id}`} tables={["delivery_jobs"]} filter={`id=eq.${job.id}`} /> : null}
      <PageHeader
        back={{ href: "/dashboard/orders", label: "Commandes" }}
        title={order.reference}
        meta={
          <>
            <StatusBadge map={ORDER_STATUS} value={order.status} />
            <Tag>{ORDER_SOURCE[order.source]}</Tag>
          </>
        }
        description={`Créée le ${formatDateTime(order.created_at)}${order.delivery_mode === "pickup" ? " · retrait en boutique" : ""}`}
        actions={
          <>
            <WhatsAppButton href={whatsappUrl(order.customer_phone, confirmationText)} label="Confirmer par WhatsApp" />
            <OrderStatusActions orderId={order.id} status={order.status} canEdit={canEdit} hasActiveJob={hasActiveJob} deliveryMode={order.delivery_mode as "delivery" | "pickup"} />
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel>
            <PanelHeader
              title="Articles"
              actions={
                productsRes.data ? (
                  <EditOrderItems
                    orderId={order.id}
                    currency={order.currency}
                    items={items.map((i) => ({ product_id: i.product_id, variant_id: i.variant_id, name: i.name, unit_price: Number(i.unit_price), quantity: i.quantity }))}
                    products={productsRes.data.map((p) => ({ ...p, price: Number(p.price), promo_price: p.promo_price === null ? null : Number(p.promo_price), variants: (p.variants as unknown as ProductVariant[]) ?? [] }))}
                  />
                ) : null
              }
            />
            <ul className="divide-y divide-line">
              {items.map((i) => (
                <li key={i.id} className="flex items-center gap-4 px-5 py-3 text-[13.5px]">
                  <span className="w-8 shrink-0 text-ink-3 tabular">{i.quantity}×</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-ink">{i.name}</p>
                    {i.variant_name ? <p className="text-xs text-ink-3">{i.variant_name}</p> : null}
                  </div>
                  {showAmounts ? (
                    <>
                      <span className="hidden text-ink-3 tabular sm:block">{formatMoney(i.unit_price, order.currency)}</span>
                      <span className="w-28 text-right font-medium tabular">{formatMoney(i.line_total, order.currency)}</span>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
            {showAmounts ? (
              <dl className="space-y-1.5 border-t border-line bg-subtle px-5 py-3 text-[13.5px]">
                <div className="flex justify-between">
                  <dt className="text-ink-3">Sous-total</dt>
                  <dd className="tabular">{formatMoney(order.subtotal, order.currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-3">Livraison</dt>
                  <dd className="tabular">{formatMoney(order.delivery_fee, order.currency)}</dd>
                </div>
                {Number(order.discount) > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-ink-3">Remise</dt>
                    <dd className="tabular">− {formatMoney(order.discount, order.currency)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between pt-1 text-[15px] font-semibold">
                  <dt>Total</dt>
                  <dd className="tabular">{formatMoney(order.total, order.currency)}</dd>
                </div>
              </dl>
            ) : null}
          </Panel>

          <Panel>
            <PanelHeader
              title="Client et livraison"
              actions={
                canEdit ? (
                  <EditOrderDetails
                    deliveryLocked={hasActiveJob}
                    order={{
                      id: order.id,
                      customer_name: order.customer_name,
                      customer_phone: order.customer_phone,
                      delivery_mode: order.delivery_mode as "delivery" | "pickup",
                      delivery_address: order.delivery_address,
                      delivery_lat: order.delivery_lat,
                      delivery_lng: order.delivery_lng,
                      delivery_fee: Number(order.delivery_fee),
                      discount: Number(order.discount),
                      payment_method: order.payment_method,
                      instructions: order.instructions,
                      internal_note: order.internal_note,
                    }}
                  />
                ) : null
              }
            />
            <div className="px-5 py-2">
              <DescriptionList
                items={[
                  {
                    label: "Client",
                    value: order.customer_id ? (
                      <Link href={`/dashboard/customers/${order.customer_id}`} className="font-medium hover:text-accent">
                        {order.customer_name}
                      </Link>
                    ) : (
                      order.customer_name
                    ),
                  },
                  {
                    label: "Téléphone",
                    value: (
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="tabular">{formatPhone(order.customer_phone)}</span>
                        <Button asChild size="xs" variant="secondary">
                          <a href={telHref(order.customer_phone) ?? "#"}>
                            <Phone /> Appeler
                          </a>
                        </Button>
                        <WhatsAppButton size="sm" href={whatsappUrl(order.customer_phone)} label="WhatsApp" />
                      </span>
                    ),
                  },
                  {
                    label: "Mode",
                    value: order.delivery_mode === "pickup" ? "Retrait en boutique" : "Livraison à domicile",
                  },
                  ...(order.delivery_mode === "delivery"
                    ? [
                        {
                          label: "Adresse",
                          value: (
                            <span>
                              {order.delivery_address ?? <span className="text-warning-ink">Non renseignée</span>}
                              {dropoff ? (
                                <a href={googleMapsDirectionsUrl(dropoff)} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1 text-xs text-accent hover:underline">
                                  <MapPin className="size-3" /> Position GPS enregistrée
                                </a>
                              ) : (
                                <span className="mt-1 block text-xs text-ink-3">Pas de position GPS</span>
                              )}
                            </span>
                          ),
                        },
                      ]
                    : []),
                  ...(order.instructions ? [{ label: "Instructions", value: order.instructions }] : []),
                  ...(order.internal_note ? [{ label: "Note interne", value: <span className="text-ink-2">{order.internal_note}</span> }] : []),
                ]}
              />
            </div>
          </Panel>

          <OrderTimeline
            orderId={order.id}
            events={(eventsRes.data ?? []).map((e) => ({ ...e, actor: e.actor_id ? actorName.get(e.actor_id) ?? null : null }))}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <DeliveryPanel
            order={{
              id: order.id,
              reference: order.reference,
              status: order.status,
              delivery_mode: order.delivery_mode as "delivery" | "pickup",
              customer_name: order.customer_name,
              customer_phone: order.customer_phone,
              total: Number(order.total),
              currency: order.currency,
              payment_status: order.payment_status,
              payment_method: order.payment_method,
              has_address: Boolean(order.delivery_address),
            }}
            job={panelJob}
            couriers={(boardRes.data ?? []) as BoardCourier[]}
            storePickup={toLatLng(storeRes.data?.lat, storeRes.data?.lng)}
            siteUrl={site}
            storeName={storeRes.data?.name ?? ctx.store.name}
            canAssign={canAssign}
            staleAfterSeconds={staleAfter}
          />
          {showAmounts ? (
            <PaymentPanel
              orderId={order.id}
              total={Number(order.total)}
              currency={order.currency}
              paymentStatus={order.payment_status}
              paymentMethod={order.payment_method}
              canEdit={canEdit}
              transactions={(txRes.data ?? []).map((t) => ({ ...t, amount: Number(t.amount) }))}
            />
          ) : null}
        </div>
      </div>
    </PageContainer>
  );
}
