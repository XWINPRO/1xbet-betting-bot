"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { claimSchema, onDemandSchema } from "@/lib/validation/schemas";
import { fail, ok, toUserMessage, zodFieldErrors, type ActionResult } from "@/lib/errors";
import { normalizePhone } from "@/lib/phone";
import type { DeliveryQuote } from "@/types/domain";
import { z } from "zod";

const token = z.string().length(32);

export async function confirmReceiptAction(t: string): Promise<ActionResult> {
  if (!token.safeParse(t).success) return fail("Lien invalide.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("confirm_delivery_receipt", { p_token: t });
  if (error) return fail(toUserMessage(error));
  return data ? ok(null, "Merci, la réception est confirmée.") : fail("Cette livraison ne peut pas être confirmée.");
}

export async function cancelOnDemandAction(t: string): Promise<ActionResult> {
  if (!token.safeParse(t).success) return fail("Lien invalide.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("cancel_on_demand_by_token", { p_token: t });
  if (error) return fail(toUserMessage(error));
  return data ? ok(null, "Demande annulée.") : fail("La course a déjà été prise en charge : contactez le livreur ou le support.");
}

export async function submitClaimAction(t: string, input: unknown): Promise<ActionResult<{ reference: string }>> {
  if (!token.safeParse(t).success) return fail("Lien invalide.");
  const parsed = claimSchema.safeParse(input);
  if (!parsed.success) return fail("Vérifiez les champs.", zodFieldErrors(parsed.error.issues));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("submit_tracking_claim", {
    p_token: t,
    p_category: parsed.data.category,
    p_description: parsed.data.description,
    p_name: parsed.data.name,
    p_phone: parsed.data.phone,
  });
  if (error || !data) return fail(toUserMessage(error));
  return ok({ reference: data }, "Réclamation enregistrée.");
}

export async function quoteDeliveryAction(input: { pickup: { lat: number; lng: number }; dropoff: { lat: number; lng: number }; package_type?: string | null }): Promise<ActionResult<DeliveryQuote>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("quote_delivery", {
    p_pickup_lat: input.pickup.lat,
    p_pickup_lng: input.pickup.lng,
    p_dropoff_lat: input.dropoff.lat,
    p_dropoff_lng: input.dropoff.lng,
    p_package_type: input.package_type ?? undefined,
  });
  if (error || !data) return fail(toUserMessage(error));
  return ok(data as unknown as DeliveryQuote);
}

export async function createOnDemandAction(input: unknown): Promise<ActionResult<{ reference: string; tracking_token: string }>> {
  const parsed = onDemandSchema.safeParse(input);
  if (!parsed.success) return fail("Vérifiez les champs signalés.", zodFieldErrors(parsed.error.issues));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_on_demand_delivery", { p_payload: parsed.data });
  if (error || !data) return fail(toUserMessage(error));
  const res = data as { reference: string; tracking_token: string };
  return ok({ reference: res.reference, tracking_token: res.tracking_token });
}

export async function placeStorefrontOrderAction(
  slug: string,
  input: {
    customer: { name: string; phone: string; address?: string; lat?: number | null; lng?: number | null };
    items: { product_id: string; variant_id?: string | null; quantity: number }[];
    delivery_mode: "delivery" | "pickup";
    payment_method: string;
    instructions?: string;
  },
): Promise<ActionResult<{ reference: string; total: number; currency: string }>> {
  const phone = normalizePhone(input.customer.phone);
  if (!phone) return fail("Numéro de téléphone invalide.", { phone: "Numéro invalide" });
  if (input.customer.name.trim().length < 2) return fail("Indiquez votre nom.", { name: "Nom requis" });
  if (input.delivery_mode === "delivery" && (input.customer.address ?? "").trim().length < 3) return fail("Indiquez l'adresse de livraison.", { address: "Adresse requise" });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("place_storefront_order", {
    p_store_slug: slug,
    p_payload: { ...input, customer: { ...input.customer, phone } },
  });
  if (error || !data) return fail(toUserMessage(error));
  const res = data as { reference: string; total: number; currency: string };
  return ok({ reference: res.reference, total: Number(res.total), currency: res.currency });
}
