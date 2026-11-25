"use server";

import { msg } from "@/i18n/msg";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { planSchema } from "@/lib/validation/schemas";
import { fail, ok, toUserMessage, zodFieldErrors, type ActionResult } from "@/lib/errors";
import type { ClaimStatus, TransactionStatus } from "@/types/domain";

async function admin() {
  await requireAdmin();
  return createSupabaseServerClient();
}

export async function setCourierSuspensionAction(courierId: string, suspended: boolean, note: string): Promise<ActionResult> {
  const supabase = await admin();
  const { error } = await supabase.rpc("admin_set_courier_suspension", { p_courier_id: courierId, p_suspended: suspended, p_note: note });
  if (error) return fail(toUserMessage(error));
  revalidatePath("/admin/couriers");
  return ok(null, suspended ? msg("Livreur suspendu.") : msg("Livreur réactivé."));
}

export async function setUserSuspensionAction(userId: string, suspended: boolean, reason: string): Promise<ActionResult> {
  const supabase = await admin();
  const { error } = await supabase.rpc("admin_set_user_suspension", { p_user_id: userId, p_suspended: suspended, p_reason: reason });
  if (error) return fail(toUserMessage(error));
  revalidatePath("/admin/users");
  return ok(null, suspended ? msg("Compte suspendu.") : msg("Compte réactivé."));
}

export async function setPlatformAdminAction(userId: string, value: boolean): Promise<ActionResult> {
  const supabase = await admin();
  const { error } = await supabase.rpc("admin_set_platform_admin", { p_user_id: userId, p_value: value });
  if (error) return fail(toUserMessage(error));
  revalidatePath("/admin/users");
  return ok(null, value ? msg("Droits administrateur accordés.") : msg("Droits administrateur retirés."));
}

export async function setStoreStatusAction(storeId: string, status: "active" | "suspended", reason: string): Promise<ActionResult> {
  const supabase = await admin();
  const { error } = await supabase.rpc("admin_set_store_status", { p_store_id: storeId, p_status: status, p_reason: reason });
  if (error) return fail(toUserMessage(error));
  revalidatePath("/admin/stores");
  return ok(null, status === "suspended" ? msg("Boutique suspendue.") : msg("Boutique réactivée."));
}

export async function adminCancelJobAction(jobId: string, reason: string): Promise<ActionResult> {
  const supabase = await admin();
  const { error } = await supabase.rpc("cancel_delivery_job", { p_job_id: jobId, p_reason: reason });
  if (error) return fail(toUserMessage(error));
  revalidatePath(`/admin/deliveries/${jobId}`);
  revalidatePath("/admin/deliveries");
  return ok(null, msg("Course annulée."));
}

export async function adminRecordJobPaymentAction(jobId: string, amount: number, method: string, reference: string): Promise<ActionResult> {
  const supabase = await admin();
  const { error } = await supabase.rpc("record_payment", { p_payload: { job_id: jobId, amount, method, provider_reference: reference, status: "confirmed" } });
  if (error) return fail(toUserMessage(error));
  revalidatePath(`/admin/deliveries/${jobId}`);
  revalidatePath("/admin/payments");
  return ok(null, msg("Paiement enregistré."));
}

export async function adminConfirmTransactionAction(txId: string, status: TransactionStatus): Promise<ActionResult> {
  const supabase = await admin();
  const { error } = await supabase.rpc("confirm_transaction", { p_tx_id: txId, p_status: status });
  if (error) return fail(toUserMessage(error));
  revalidatePath("/admin/payments");
  return ok(null, msg("Transaction mise à jour."));
}

export async function reviewSubscriptionAction(id: string, approve: boolean, note: string): Promise<ActionResult> {
  const supabase = await admin();
  const { error } = await supabase.rpc("admin_review_subscription", { p_subscription_id: id, p_approve: approve, p_note: note });
  if (error) return fail(toUserMessage(error));
  revalidatePath("/admin/subscriptions");
  revalidatePath("/admin", "layout");
  return ok(null, approve ? msg("Abonnement activé.") : msg("Demande refusée."));
}

export async function grantSubscriptionAction(storeId: string, planCode: string, months: number, note: string): Promise<ActionResult> {
  const supabase = await admin();
  const { error } = await supabase.rpc("admin_grant_subscription", { p_store_id: storeId, p_plan_code: planCode, p_months: months, p_note: note });
  if (error) return fail(toUserMessage(error));
  revalidatePath("/admin/subscriptions");
  revalidatePath("/admin/stores");
  return ok(null, msg("Abonnement activé."));
}

export async function endSubscriptionAction(id: string, note: string): Promise<ActionResult> {
  const supabase = await admin();
  const { error } = await supabase.rpc("admin_end_subscription", { p_subscription_id: id, p_note: note });
  if (error) return fail(toUserMessage(error));
  revalidatePath("/admin/subscriptions");
  return ok(null, msg("Abonnement arrêté."));
}

export async function updatePlanAction(code: string, input: unknown): Promise<ActionResult> {
  const supabase = await admin();
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return fail(msg("Vérifiez les champs."), zodFieldErrors(parsed.error.issues));
  const { error } = await supabase.rpc("admin_update_plan", { p_code: code, p_payload: parsed.data });
  if (error) return fail(toUserMessage(error));
  revalidatePath("/admin/plans");
  revalidatePath("/");
  return ok(null, msg("Plan enregistré."));
}

export async function updateClaimAction(id: string, status: ClaimStatus, resolution: string): Promise<ActionResult> {
  const supabase = await admin();
  const { error } = await supabase.from("claims").update({ status, resolution: resolution || null }).eq("id", id);
  if (error) return fail(toUserMessage(error));
  revalidatePath("/admin/claims");
  return ok(null, msg("Réclamation mise à jour."));
}

export async function updateSettingAction(key: string, value: number | boolean | string): Promise<ActionResult> {
  const supabase = await admin();
  const { error } = await supabase.rpc("admin_update_setting", { p_key: key, p_value: value });
  if (error) return fail(toUserMessage(error));
  revalidatePath("/admin/settings");
  return ok(null, msg("Paramètre enregistré."));
}
