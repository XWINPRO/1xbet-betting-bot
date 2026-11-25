"use server";

import { msg } from "@/i18n/msg";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/auth";
import { createOrderSchema, orderDetailsSchema, orderItemInput, paymentSchema } from "@/lib/validation/schemas";
import { fail, ok, toUserMessage, zodFieldErrors, type ActionResult } from "@/lib/errors";
import { normalizePhone } from "@/lib/phone";
import type { OrderStatus, TransactionStatus } from "@/types/domain";
import { z } from "zod";

export async function createOrderAction(input: unknown): Promise<ActionResult<{ id: string; reference: string }>> {
  const ctx = await getStoreContext();
  if (!ctx.can("orders.create")) return fail(msg("Vous ne pouvez pas créer de commande."));
  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) return fail(msg("Vérifiez les champs signalés."), zodFieldErrors(parsed.error.issues));
  const d = parsed.data;
  if (!d.customer_id) {
    const phone = normalizePhone(d.customer.phone);
    if (!phone) return fail(msg("Téléphone du client invalide."), { "customer.phone": msg("Numéro invalide") });
    d.customer.phone = phone;
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_order", {
    p_store_id: ctx.storeId,
    p_payload: {
      ...d,
      customer_id: d.customer_id ?? null,
      items: d.items.map((i) => ({
        product_id: i.product_id ?? null,
        variant_id: i.variant_id ?? null,
        name: i.name ?? null,
        unit_price: i.unit_price,
        quantity: i.quantity,
      })),
    },
  });
  if (error || !data) return fail(toUserMessage(error));
  const res = data as { id: string; reference: string };
  revalidatePath("/dashboard", "layout");
  return ok({ id: res.id, reference: res.reference });
}

export async function setOrderStatusAction(orderId: string, status: OrderStatus, note?: string): Promise<ActionResult> {
  await getStoreContext();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_order_status", { p_order_id: orderId, p_status: status, p_note: note ?? "" });
  if (error) return fail(toUserMessage(error));
  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath("/dashboard", "layout");
  return ok(null);
}

export async function updateOrderDetailsAction(orderId: string, input: unknown): Promise<ActionResult> {
  const ctx = await getStoreContext();
  if (!ctx.can("orders.edit")) return fail(msg("Vous ne pouvez pas modifier les commandes."));
  const parsed = orderDetailsSchema.safeParse(input);
  if (!parsed.success) return fail(msg("Vérifiez les champs signalés."), zodFieldErrors(parsed.error.issues));
  const d = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("orders")
    .update({
      ...d,
      delivery_fee: d.delivery_mode === "pickup" ? 0 : d.delivery_fee,
      delivery_address: d.delivery_mode === "pickup" ? null : d.delivery_address,
      delivery_lat: d.delivery_mode === "pickup" ? null : d.delivery_lat,
      delivery_lng: d.delivery_mode === "pickup" ? null : d.delivery_lng,
    })
    .eq("id", orderId)
    .eq("store_id", ctx.storeId);
  if (error) return fail(toUserMessage(error));
  revalidatePath(`/dashboard/orders/${orderId}`);
  return ok(null, msg("Commande mise à jour."));
}

export async function setOrderItemsAction(orderId: string, items: unknown): Promise<ActionResult> {
  await getStoreContext();
  const parsed = z.array(orderItemInput).min(1, msg("Ajoutez au moins un article")).safeParse(items);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? msg("Articles invalides."));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_order_items", { p_order_id: orderId, p_items: parsed.data });
  if (error) return fail(toUserMessage(error));
  revalidatePath(`/dashboard/orders/${orderId}`);
  return ok(null, msg("Articles mis à jour."));
}

export async function addOrderNoteAction(orderId: string, note: string): Promise<ActionResult> {
  await getStoreContext();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("add_order_note", { p_order_id: orderId, p_note: note });
  if (error) return fail(toUserMessage(error));
  revalidatePath(`/dashboard/orders/${orderId}`);
  return ok(null);
}

export async function recordPaymentAction(orderId: string, input: unknown): Promise<ActionResult> {
  await getStoreContext();
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return fail(msg("Vérifiez les champs."), zodFieldErrors(parsed.error.issues));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_payment", { p_payload: { ...parsed.data, order_id: orderId, status: "confirmed" } });
  if (error) return fail(toUserMessage(error));
  revalidatePath(`/dashboard/orders/${orderId}`);
  return ok(null, msg("Paiement enregistré."));
}

export async function confirmTransactionAction(txId: string, status: TransactionStatus, path?: string): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("confirm_transaction", { p_tx_id: txId, p_status: status });
  if (error) return fail(toUserMessage(error));
  if (path) revalidatePath(path);
  return ok(null, status === "confirmed" ? msg("Paiement confirmé.") : msg("Transaction mise à jour."));
}
