"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { fail, ok, toUserMessage, type ActionResult } from "@/lib/errors";

function refresh(orderId?: string | null) {
  if (orderId) revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath("/dashboard/deliveries");
  revalidatePath("/admin/deliveries");
}

export async function createDeliveryJobAction(
  orderId: string,
  options: { courier_id?: string | null; collect_amount?: number | null; instructions?: string | null } = {},
): Promise<ActionResult<{ id: string; reference: string; tracking_token: string }>> {
  if (!(await getViewer())) return fail("Session expirée.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_delivery_job", {
    p_order_id: orderId,
    p_options: {
      courier_id: options.courier_id ?? null,
      collect_amount: options.collect_amount ?? null,
      instructions: options.instructions ?? null,
    },
  });
  if (error || !data) return fail(toUserMessage(error));
  refresh(orderId);
  return ok(data as { id: string; reference: string; tracking_token: string });
}

export async function assignCourierAction(jobId: string, courierId: string, orderId?: string | null): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("assign_courier", { p_job_id: jobId, p_courier_id: courierId });
  if (error) return fail(toUserMessage(error));
  refresh(orderId);
  return ok(null, "Course envoyée au livreur.");
}

export async function unassignCourierAction(jobId: string, orderId?: string | null): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("unassign_courier", { p_job_id: jobId });
  if (error) return fail(toUserMessage(error));
  refresh(orderId);
  return ok(null, "Livreur retiré de la course.");
}

export async function cancelDeliveryJobAction(jobId: string, reason: string, orderId?: string | null): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("cancel_delivery_job", { p_job_id: jobId, p_reason: reason });
  if (error) return fail(toUserMessage(error));
  refresh(orderId);
  return ok(null, "Course annulée.");
}

export async function getProofUrlAction(path: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.storage.from("delivery-proofs").createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}
