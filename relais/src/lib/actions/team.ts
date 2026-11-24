"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSiteUrl, getStoreContext } from "@/lib/auth";
import { STAFF_PERMISSIONS } from "@/lib/permissions";
import { fail, ok, toUserMessage, type ActionResult } from "@/lib/errors";

const VALID = new Set<string>(STAFF_PERMISSIONS.map((p) => p.key));

export async function createStaffInviteAction(permissions: string[], label: string): Promise<ActionResult<{ url: string }>> {
  const ctx = await getStoreContext();
  if (!ctx.isOwner) return fail("Action réservée au propriétaire.");
  const perms = permissions.filter((p) => VALID.has(p));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_staff_invitation", { p_store_id: ctx.storeId, p_permissions: perms, p_label: label });
  if (error || !data) return fail(toUserMessage(error));
  revalidatePath("/dashboard/settings");
  return ok({ url: `${await getSiteUrl()}/invite/${data}` });
}

export async function revokeInvitationAction(id: string): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("revoke_invitation", { p_invitation_id: id });
  if (error) return fail(toUserMessage(error));
  revalidatePath("/dashboard/settings");
  return ok(null, "Invitation révoquée.");
}

export async function updateMemberPermissionsAction(userId: string, permissions: string[]): Promise<ActionResult> {
  const ctx = await getStoreContext();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_member_permissions", {
    p_store_id: ctx.storeId,
    p_user_id: userId,
    p_permissions: permissions.filter((p) => VALID.has(p)),
  });
  if (error) return fail(toUserMessage(error));
  revalidatePath("/dashboard/settings");
  return ok(null, "Permissions mises à jour.");
}

export async function removeMemberAction(userId: string): Promise<ActionResult> {
  const ctx = await getStoreContext();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("remove_store_member", { p_store_id: ctx.storeId, p_user_id: userId });
  if (error) return fail(toUserMessage(error));
  revalidatePath("/dashboard/settings");
  return ok(null, "Membre retiré.");
}
