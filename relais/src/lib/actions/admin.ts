"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { pricingRuleSchema } from "@/lib/validation/schemas";
import { fail, ok, toUserMessage, zodFieldErrors, type ActionResult } from "@/lib/errors";
import type { ClaimStatus, TransactionStatus } from "@/types/domain";

async function admin() {
  await requireAdmin();
  return createSupabaseServerClient();
}

export async function reviewCourierAction(courierId: string, decision: "approve" | "reject" | "suspend" | "reactivate", note: string): Promise<ActionResult> {
  const supabase = await admin();
  const { error } = await supabase.rpc("admin_review_courier", { p_courier_id: courierId, p_decision: decision, p_note: note });
  if (error) return fail(toUserMessage(error));
  revalidatePath("/admin/couriers");
  return ok(null, "Décision enregistrée.");
}

export async function courierDocumentUrlAction(path: string): Promise<string | null> {
  const supabase = await admin();
  const { data } = await supabase.storage.from("courier-documents").createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

export async function setUserSuspensionAction(userId: string, suspended: boolean, reason: string): Promise<ActionResult> {
  const supabase = await admin();
  const { error } = await supabase.rpc("admin_set_user_suspension", { p_user_id: userId, p_suspended: suspended, p_reason: reason });
  if (error) return fail(toUserMessage(error));
  revalidatePath("/admin/users");
  return ok(null, suspended ? "Compte suspendu." : "Compte réactivé.");
}

export async function setPlatformAdminAction(userId: string, value: boolean): Promise<ActionResult> {
  const supabase = await admin();
  const { error } = await supabase.rpc("admin_set_platform_admin", { p_user_id: userId, p_value: value });
  if (error) return fail(toUserMessage(error));
  revalidatePath("/admin/users");
  return ok(null, value ? "Droits administrateur accordés." : "Droits administrateur retirés.");
}

export async function setStoreStatusAction(storeId: string, status: "active" | "suspended", reason: string): Promise<ActionResult> {
  const supabase = await admin();
  const { error } = await supabase.rpc("admin_set_store_status", { p_store_id: storeId, p_status: status, p_reason: reason });
  if (error) return fail(toUserMessage(error));
  revalidatePath("/admin/stores");
  return ok(null, status === "suspended" ? "Boutique suspendue." : "Boutique réactivée.");
}

export async function adminAssignCourierAction(jobId: string, courierId: string): Promise<ActionResult> {
  const supabase = await admin();
  const { error } = await supabase.rpc("assign_courier", { p_job_id: jobId, p_courier_id: courierId });
  if (error) return fail(toUserMessage(error));
  revalidatePath(`/admin/deliveries/${jobId}`);
  revalidatePath("/admin/deliveries");
  return ok(null, "Course proposée au livreur.");
}

export async function adminUnassignAction(jobId: string): Promise<ActionResult> {
  const supabase = await admin();
  const { error } = await supabase.rpc("unassign_courier", { p_job_id: jobId });
  if (error) return fail(toUserMessage(error));
  revalidatePath(`/admin/deliveries/${jobId}`);
  return ok(null, "Livreur retiré.");
}

export async function adminCancelJobAction(jobId: string, reason: string): Promise<ActionResult> {
  const supabase = await admin();
  const { error } = await supabase.rpc("cancel_delivery_job", { p_job_id: jobId, p_reason: reason });
  if (error) return fail(toUserMessage(error));
  revalidatePath(`/admin/deliveries/${jobId}`);
  revalidatePath("/admin/deliveries");
  return ok(null, "Course annulée.");
}

export async function adminRecordJobPaymentAction(jobId: string, amount: number, method: string, reference: string): Promise<ActionResult> {
  const supabase = await admin();
  const { error } = await supabase.rpc("record_payment", { p_payload: { job_id: jobId, amount, method, provider_reference: reference, status: "confirmed" } });
  if (error) return fail(toUserMessage(error));
  revalidatePath(`/admin/deliveries/${jobId}`);
  revalidatePath("/admin/payments");
  return ok(null, "Paiement enregistré.");
}

export async function adminConfirmTransactionAction(txId: string, status: TransactionStatus): Promise<ActionResult> {
  const supabase = await admin();
  const { error } = await supabase.rpc("confirm_transaction", { p_tx_id: txId, p_status: status });
  if (error) return fail(toUserMessage(error));
  revalidatePath("/admin/payments");
  return ok(null, "Transaction mise à jour.");
}

export async function savePricingRuleAction(id: string | null, input: unknown): Promise<ActionResult> {
  const supabase = await admin();
  const parsed = pricingRuleSchema.safeParse(input);
  if (!parsed.success) return fail("Vérifiez les champs.", zodFieldErrors(parsed.error.issues));
  const { surcharges, ...rest } = parsed.data;
  const payload = { ...rest, package_surcharges: surcharges };
  if (payload.is_active) {
    // Une seule grille active à la fois.
    await supabase.from("pricing_rules").update({ is_active: false }).eq("is_active", true).neq("id", id ?? "00000000-0000-0000-0000-000000000000");
  }
  const { error } = id ? await supabase.from("pricing_rules").update(payload).eq("id", id) : await supabase.from("pricing_rules").insert(payload);
  if (error) return fail(toUserMessage(error));
  revalidatePath("/admin/pricing");
  return ok(null, "Tarification enregistrée.");
}

export async function deletePricingRuleAction(id: string): Promise<ActionResult> {
  const supabase = await admin();
  const { error } = await supabase.from("pricing_rules").delete().eq("id", id);
  if (error) return fail(toUserMessage(error));
  revalidatePath("/admin/pricing");
  return ok(null, "Grille supprimée.");
}

export async function updateClaimAction(id: string, status: ClaimStatus, resolution: string): Promise<ActionResult> {
  const supabase = await admin();
  const { error } = await supabase.from("claims").update({ status, resolution: resolution || null }).eq("id", id);
  if (error) return fail(toUserMessage(error));
  revalidatePath("/admin/claims");
  return ok(null, "Réclamation mise à jour.");
}

export async function updateSettingAction(key: string, value: number | boolean): Promise<ActionResult> {
  const supabase = await admin();
  const { error } = await supabase.rpc("admin_update_setting", { p_key: key, p_value: value });
  if (error) return fail(toUserMessage(error));
  revalidatePath("/admin/settings");
  return ok(null, "Paramètre enregistré.");
}
