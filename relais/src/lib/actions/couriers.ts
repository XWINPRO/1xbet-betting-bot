"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSiteUrl, getStoreContext } from "@/lib/auth";
import { courierFormSchema } from "@/lib/validation/schemas";
import { fail, ok, toUserMessage, zodFieldErrors, type ActionResult } from "@/lib/errors";

export async function addCourierAction(input: unknown): Promise<ActionResult<{ courierId: string; inviteUrl: string }>> {
  const ctx = await getStoreContext();
  if (!ctx.isOwner) return fail("Seul le propriétaire peut ajouter des livreurs.");
  const parsed = courierFormSchema.safeParse(input);
  if (!parsed.success) return fail("Vérifiez les champs.", zodFieldErrors(parsed.error.issues));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("store_add_courier", { p_store_id: ctx.storeId, p_payload: parsed.data });
  if (error || !data) return fail(toUserMessage(error));
  const res = data as { courier_id: string; token: string };
  const site = await getSiteUrl();
  revalidatePath("/dashboard/couriers");
  return ok({ courierId: res.courier_id, inviteUrl: `${site}/invite/${res.token}` });
}

export async function updateCourierAction(courierId: string, input: unknown): Promise<ActionResult> {
  const ctx = await getStoreContext();
  if (!ctx.isOwner) return fail("Action réservée au propriétaire.");
  const parsed = courierFormSchema.safeParse(input);
  if (!parsed.success) return fail("Vérifiez les champs.", zodFieldErrors(parsed.error.issues));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("store_update_courier", { p_store_id: ctx.storeId, p_courier_id: courierId, p_payload: parsed.data });
  if (error) return fail(toUserMessage(error));
  revalidatePath("/dashboard/couriers");
  revalidatePath(`/dashboard/couriers/${courierId}`);
  return ok(null, "Livreur mis à jour.");
}

export async function setCourierAccessAction(courierId: string, active: boolean): Promise<ActionResult> {
  const ctx = await getStoreContext();
  if (!ctx.isOwner) return fail("Action réservée au propriétaire.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("store_set_courier_access", { p_store_id: ctx.storeId, p_courier_id: courierId, p_active: active });
  if (error) return fail(toUserMessage(error));
  revalidatePath("/dashboard/couriers");
  revalidatePath(`/dashboard/couriers/${courierId}`);
  return ok(null, active ? "Accès réactivé." : "Accès suspendu.");
}

export async function regenerateCourierInviteAction(courierId: string): Promise<ActionResult<{ inviteUrl: string }>> {
  const ctx = await getStoreContext();
  if (!ctx.isOwner) return fail("Action réservée au propriétaire.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("store_create_courier_invite", { p_store_id: ctx.storeId, p_courier_id: courierId });
  if (error || !data) return fail(toUserMessage(error));
  const site = await getSiteUrl();
  return ok({ inviteUrl: `${site}/invite/${data}` });
}
