"use server";

import { msg } from "@/i18n/msg";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/auth";
import { categorySchema, productSchema } from "@/lib/validation/schemas";
import { fail, ok, toUserMessage, zodFieldErrors, type ActionResult } from "@/lib/errors";
import type { ProductStatus } from "@/types/domain";

function revalidate(storeSlug: string) {
  revalidatePath("/dashboard/products");
  revalidatePath(`/shop/${storeSlug}`);
}

export async function saveProductAction(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await getStoreContext();
  if (!ctx.can("products.manage")) return fail(msg("Vous ne pouvez pas modifier le catalogue."));
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return fail(msg("Vérifiez les champs signalés."), zodFieldErrors(parsed.error.issues));
  const d = parsed.data;
  // Les images doivent appartenir au dossier de la boutique.
  if (d.images.some((p) => !p.startsWith(`${ctx.storeId}/`))) return fail(msg("Image invalide."));
  const payload = {
    ...d,
    stock: d.track_stock ? d.stock : null,
    variants: d.variants,
  };
  const supabase = await createSupabaseServerClient();
  const res = id
    ? await supabase.from("products").update(payload).eq("id", id).eq("store_id", ctx.storeId).select("id").single()
    : await supabase.from("products").insert({ ...payload, store_id: ctx.storeId }).select("id").single();
  if (res.error || !res.data) {
    const message = res.error?.code === "23505" ? msg("Ce SKU est déjà utilisé par un autre produit.") : toUserMessage(res.error);
    return fail(message, res.error?.code === "23505" ? { sku: message } : undefined);
  }
  revalidate(ctx.store.slug);
  return ok({ id: res.data.id }, msg("Produit enregistré."));
}

export async function setProductStatusAction(id: string, status: ProductStatus): Promise<ActionResult> {
  const ctx = await getStoreContext();
  if (!ctx.can("products.manage")) return fail(msg("Action non autorisée."));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("products").update({ status }).eq("id", id).eq("store_id", ctx.storeId);
  if (error) return fail(toUserMessage(error));
  revalidate(ctx.store.slug);
  return ok(null);
}

export async function deleteProductAction(id: string): Promise<ActionResult> {
  const ctx = await getStoreContext();
  if (!ctx.can("products.manage")) return fail(msg("Action non autorisée."));
  const supabase = await createSupabaseServerClient();
  const { data: product } = await supabase.from("products").select("images").eq("id", id).eq("store_id", ctx.storeId).maybeSingle();
  const { error } = await supabase.from("products").delete().eq("id", id).eq("store_id", ctx.storeId);
  if (error) return fail(toUserMessage(error));
  if (product?.images?.length) await supabase.storage.from("store-assets").remove(product.images);
  revalidate(ctx.store.slug);
  return ok(null, msg("Produit supprimé. Les commandes passées conservent son nom et son prix."));
}

export async function createCategoryAction(name: string): Promise<ActionResult<{ id: string; name: string }>> {
  const ctx = await getStoreContext();
  if (!ctx.can("products.manage")) return fail(msg("Action non autorisée."));
  const parsed = categorySchema.safeParse({ name });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? msg("Nom invalide."));
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase.from("product_categories").select("id", { count: "exact", head: true }).eq("store_id", ctx.storeId);
  const { data, error } = await supabase
    .from("product_categories")
    .insert({ store_id: ctx.storeId, name: parsed.data.name, position: count ?? 0 })
    .select("id, name")
    .single();
  if (error || !data) return fail(error?.code === "23505" ? msg("Cette catégorie existe déjà.") : toUserMessage(error));
  revalidate(ctx.store.slug);
  return ok(data);
}

export async function renameCategoryAction(id: string, name: string): Promise<ActionResult> {
  const ctx = await getStoreContext();
  const parsed = categorySchema.safeParse({ name });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? msg("Nom invalide."));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("product_categories").update({ name: parsed.data.name }).eq("id", id).eq("store_id", ctx.storeId);
  if (error) return fail(error.code === "23505" ? msg("Cette catégorie existe déjà.") : toUserMessage(error));
  revalidate(ctx.store.slug);
  return ok(null);
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  const ctx = await getStoreContext();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("product_categories").delete().eq("id", id).eq("store_id", ctx.storeId);
  if (error) return fail(toUserMessage(error));
  revalidate(ctx.store.slug);
  return ok(null, msg("Catégorie supprimée. Ses produits sont conservés sans catégorie."));
}
