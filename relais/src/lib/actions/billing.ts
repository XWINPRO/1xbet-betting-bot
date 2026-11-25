"use server";

import { revalidatePath } from "next/cache";
import { msg } from "@/i18n/msg";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/auth";
import { subscriptionRequestSchema } from "@/lib/validation/schemas";
import { fail, ok, toUserMessage, zodFieldErrors, type ActionResult } from "@/lib/errors";

/**
 * Le commerçant déclare avoir payé un plan par mobile money. Aucun débit
 * n'est simulé : l'administrateur vérifie la transaction reçue puis active
 * l'abonnement.
 */
export async function requestSubscriptionAction(input: unknown): Promise<ActionResult<{ reference: string }>> {
  const ctx = await getStoreContext();
  if (!ctx.isOwner) return fail(msg("Action réservée au propriétaire."));
  const parsed = subscriptionRequestSchema.safeParse(input);
  if (!parsed.success) return fail(msg("Vérifiez les champs."), zodFieldErrors(parsed.error.issues));
  const d = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("request_subscription", {
    p_store_id: ctx.storeId,
    p_plan_code: d.plan_code,
    p_months: d.months,
    p_method: d.method,
    p_payer_phone: d.payer_phone,
    p_payment_reference: d.payment_reference,
    p_note: d.note ?? undefined,
  });
  if (error || !data) return fail(toUserMessage(error));
  revalidatePath("/dashboard", "layout");
  return ok({ reference: data }, msg("Demande envoyée. Votre plan sera activé dès la vérification du paiement."));
}

export async function cancelSubscriptionRequestAction(id: string): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("cancel_subscription_request", { p_subscription_id: id });
  if (error) return fail(toUserMessage(error));
  revalidatePath("/dashboard", "layout");
  return ok(null, msg("Demande annulée."));
}
