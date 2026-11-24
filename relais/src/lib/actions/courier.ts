"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewer, requireViewer } from "@/lib/auth";
import { courierApplicationSchema } from "@/lib/validation/schemas";
import { normalizePhone } from "@/lib/phone";
import { fail, ok, toUserMessage, zodFieldErrors, type ActionResult } from "@/lib/errors";
import type { JobStatus } from "@/types/domain";

async function client() {
  if (!(await getViewer())) throw new Error("not_authenticated");
  return createSupabaseServerClient();
}

function refresh(jobId?: string) {
  revalidatePath("/courier", "layout");
  if (jobId) revalidatePath(`/courier/jobs/${jobId}`);
}

export async function setAvailabilityAction(available: boolean): Promise<ActionResult> {
  const supabase = await client();
  const { error } = await supabase.rpc("courier_set_availability", { p_available: available });
  if (error) return fail(toUserMessage(error));
  refresh();
  return ok(null);
}

export async function respondOfferAction(jobId: string, accept: boolean, reason?: string): Promise<ActionResult> {
  const supabase = await client();
  const { error } = await supabase.rpc("courier_respond_offer", { p_job_id: jobId, p_accept: accept, p_reason: reason ?? "" });
  if (error) return fail(toUserMessage(error));
  refresh(jobId);
  return ok(null, accept ? "Course acceptée." : "Course refusée.");
}

export async function claimJobAction(jobId: string): Promise<ActionResult> {
  const supabase = await client();
  const { error } = await supabase.rpc("courier_claim_job", { p_job_id: jobId });
  if (error) return fail(toUserMessage(error));
  refresh(jobId);
  return ok(null, "Course acceptée.");
}

export async function updateJobStatusAction(
  jobId: string,
  status: Extract<JobStatus, "picked_up" | "in_transit" | "delivered" | "failed">,
  payload: { reason?: string; note?: string; proof_photo_path?: string | null; recipient_name?: string; cash_collected?: boolean; lat?: number | null; lng?: number | null } = {},
): Promise<ActionResult> {
  const supabase = await client();
  const { error } = await supabase.rpc("courier_update_job", { p_job_id: jobId, p_status: status, p_payload: payload });
  if (error) return fail(toUserMessage(error));
  refresh(jobId);
  return ok(null);
}

export async function reportIssueAction(jobId: string, category: string, description: string): Promise<ActionResult<{ reference: string }>> {
  if (description.trim().length < 5) return fail("Décrivez le problème (5 caractères minimum).");
  const supabase = await client();
  const { data, error } = await supabase.rpc("courier_report_issue", { p_job_id: jobId, p_category: category, p_description: description });
  if (error || !data) return fail(toUserMessage(error));
  refresh(jobId);
  return ok({ reference: data }, "Signalement envoyé.");
}

export async function applyPlatformCourierAction(input: unknown): Promise<ActionResult> {
  const viewer = await requireViewer("/courier/apply");
  const parsed = courierApplicationSchema.safeParse(input);
  if (!parsed.success) return fail("Vérifiez les champs.", zodFieldErrors(parsed.error.issues));
  if (parsed.data.id_document_path && !parsed.data.id_document_path.startsWith(`${viewer.id}/`)) return fail("Document invalide.");
  const supabase = await createSupabaseServerClient();
  const { accept_terms: _accept, ...payload } = parsed.data;
  const { error } = await supabase.rpc("apply_platform_courier", { p_payload: payload });
  if (error) return fail(toUserMessage(error));
  revalidatePath("/courier", "layout");
  redirect("/courier");
}

export async function updateCourierProfileAction(input: { phone: string; vehicle_type: string; vehicle_plate: string; zone: string; resubmit?: boolean; id_document_path?: string | null }): Promise<ActionResult> {
  const phone = normalizePhone(input.phone);
  if (!phone) return fail("Numéro de téléphone invalide.", { phone: "Numéro invalide" });
  const supabase = await client();
  const { error } = await supabase.rpc("courier_update_profile", { p_payload: { ...input, phone } });
  if (error) return fail(toUserMessage(error));
  refresh();
  return ok(null, "Profil mis à jour.");
}
