"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { STORE_COOKIE, getStoreContext, requireViewer } from "@/lib/auth";
import { createStoreSchema, storeOperationsSchema, storeSettingsSchema } from "@/lib/validation/schemas";
import { fail, ok, toUserMessage, zodFieldErrors, type ActionResult } from "@/lib/errors";

export async function createStoreAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireViewer("/onboarding");
  const parsed = createStoreSchema.safeParse(input);
  if (!parsed.success) return fail("Vérifiez les champs.", zodFieldErrors(parsed.error.issues));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_store", { p_payload: parsed.data });
  if (error || !data) {
    const message = toUserMessage(error);
    return fail(message, error?.message === "slug_taken" ? { slug: message } : undefined);
  }
  const cookieStore = await cookies();
  cookieStore.set(STORE_COOKIE, data, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365 });
  return ok({ id: data });
}

export async function updateStoreSettingsAction(input: unknown): Promise<ActionResult> {
  const ctx = await getStoreContext();
  if (!ctx.isOwner) return fail("Seul le propriétaire peut modifier la boutique.");
  const parsed = storeSettingsSchema.safeParse(input);
  if (!parsed.success) return fail("Vérifiez les champs.", zodFieldErrors(parsed.error.issues));
  if ((parsed.data.lat === null) !== (parsed.data.lng === null)) return fail("Position incomplète.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("stores").update(parsed.data).eq("id", ctx.storeId);
  if (error) {
    const msg = error.code === "23505" ? "Cette adresse de boutique est déjà utilisée." : toUserMessage(error);
    return fail(msg, error.code === "23505" ? { slug: msg } : undefined);
  }
  revalidatePath("/dashboard", "layout");
  revalidatePath(`/shop/${parsed.data.slug}`);
  return ok(null, "Boutique enregistrée.");
}

export async function updateStoreOperationsAction(input: unknown): Promise<ActionResult> {
  const ctx = await getStoreContext();
  if (!ctx.isOwner) return fail("Seul le propriétaire peut modifier ces règles.");
  const parsed = storeOperationsSchema.safeParse(input);
  if (!parsed.success) return fail("Vérifiez les champs.", zodFieldErrors(parsed.error.issues));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("stores").update(parsed.data).eq("id", ctx.storeId);
  if (error) return fail(toUserMessage(error));
  revalidatePath("/dashboard", "layout");
  return ok(null, "Règles enregistrées.");
}

export async function setStorePublishedAction(published: boolean): Promise<ActionResult> {
  const ctx = await getStoreContext();
  if (!ctx.isOwner) return fail("Seul le propriétaire peut publier la boutique.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("stores").update({ is_published: published }).eq("id", ctx.storeId);
  if (error) return fail(toUserMessage(error));
  revalidatePath("/dashboard", "layout");
  return ok(null, published ? "Boutique publiée." : "Boutique masquée.");
}

export async function checkSlugAvailableAction(slug: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("stores").select("id").eq("slug", slug).maybeSingle();
  // Une boutique non publiée d'un autre compte n'est pas visible : la base tranche à la création.
  return !data;
}
