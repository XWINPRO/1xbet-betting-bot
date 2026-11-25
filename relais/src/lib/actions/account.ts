"use server";

import { msg } from "@/i18n/msg";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { fail, ok, toUserMessage, type ActionResult } from "@/lib/errors";

export async function updateProfileAction(input: { full_name: string; phone: string }): Promise<ActionResult> {
  const viewer = await requireViewer("/account");
  const name = input.full_name.trim();
  if (name.length < 2) return fail(msg("Nom trop court."), { full_name: msg("Nom trop court") });
  const phone = input.phone ? normalizePhone(input.phone) : null;
  if (input.phone && !phone) return fail(msg("Numéro invalide."), { phone: msg("Numéro invalide") });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("profiles").update({ full_name: name.slice(0, 120), phone }).eq("id", viewer.id);
  if (error) return fail(toUserMessage(error));
  revalidatePath("/", "layout");
  return ok(null, msg("Profil enregistré."));
}

export async function changePasswordAction(password: string): Promise<ActionResult> {
  await requireViewer("/account");
  if (password.length < 8) return fail(msg("8 caractères minimum."));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return fail(toUserMessage(error));
  return ok(null, msg("Mot de passe modifié."));
}
