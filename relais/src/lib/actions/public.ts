"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { claimSchema } from "@/lib/validation/schemas";
import { msg } from "@/i18n/msg";
import { fail, ok, toUserMessage, zodFieldErrors, type ActionResult } from "@/lib/errors";
import { normalizePhone } from "@/lib/phone";
import { z } from "zod";

const token = z.string().length(32);

export async function confirmReceiptAction(t: string): Promise<ActionResult> {
  if (!token.safeParse(t).success) return fail(msg("Lien invalide."));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("confirm_delivery_receipt", { p_token: t });
  if (error) return fail(toUserMessage(error));
  return data ? ok(null, msg("Merci, la réception est confirmée.")) : fail(msg("Cette livraison ne peut pas être confirmée."));
}

export async function submitClaimAction(t: string, input: unknown): Promise<ActionResult<{ reference: string }>> {
  if (!token.safeParse(t).success) return fail(msg("Lien invalide."));
  const parsed = claimSchema.safeParse(input);
  if (!parsed.success) return fail(msg("Vérifiez les champs."), zodFieldErrors(parsed.error.issues));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("submit_tracking_claim", {
    p_token: t,
    p_category: parsed.data.category,
    p_description: parsed.data.description,
    p_name: parsed.data.name,
    p_phone: parsed.data.phone,
  });
  if (error || !data) return fail(toUserMessage(error));
  return ok({ reference: data }, msg("Réclamation enregistrée."));
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
  if (!phone) return fail(msg("Numéro de téléphone invalide."), { phone: msg("Numéro invalide") });
  if (input.customer.name.trim().length < 2) return fail(msg("Indiquez votre nom."), { name: msg("Nom requis") });
  if (input.delivery_mode === "delivery" && (input.customer.address ?? "").trim().length < 3) return fail(msg("Indiquez l'adresse de livraison."), { address: msg("Adresse requise") });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("place_storefront_order", {
    p_store_slug: slug,
    p_payload: { ...input, customer: { ...input.customer, phone } },
  });
  if (error || !data) return fail(toUserMessage(error));
  const res = data as { reference: string; total: number; currency: string };
  return ok({ reference: res.reference, total: Number(res.total), currency: res.currency });
}
