"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/auth";
import { customerSchema } from "@/lib/validation/schemas";
import { fail, ok, toUserMessage, zodFieldErrors, type ActionResult } from "@/lib/errors";
import { sanitizeSearch } from "@/lib/search";

export type CustomerOption = {
  id: string;
  full_name: string;
  phone: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
};

export async function searchCustomersAction(q: string): Promise<CustomerOption[]> {
  const ctx = await getStoreContext();
  const supabase = await createSupabaseServerClient();
  const term = sanitizeSearch(q);
  let query = supabase
    .from("customers")
    .select("id, full_name, phone, address, lat, lng")
    .eq("store_id", ctx.storeId)
    .order("updated_at", { ascending: false })
    .limit(8);
  if (term) query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term.replace(/\s/g, "")}%`);
  const { data } = await query;
  return data ?? [];
}

export async function saveCustomerAction(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await getStoreContext();
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return fail("Vérifiez les champs.", zodFieldErrors(parsed.error.issues));
  const supabase = await createSupabaseServerClient();
  const payload = { ...parsed.data, whatsapp: parsed.data.whatsapp ?? parsed.data.phone };
  const res = id
    ? await supabase.from("customers").update(payload).eq("id", id).eq("store_id", ctx.storeId).select("id").single()
    : await supabase.from("customers").insert({ ...payload, store_id: ctx.storeId }).select("id").single();
  if (res.error || !res.data) {
    const msg = res.error?.code === "23505" ? "Un client existe déjà avec ce numéro." : toUserMessage(res.error);
    return fail(msg, res.error?.code === "23505" ? { phone: msg } : undefined);
  }
  revalidatePath("/dashboard/customers");
  return ok({ id: res.data.id }, "Client enregistré.");
}

export async function deleteCustomerAction(id: string): Promise<ActionResult> {
  const ctx = await getStoreContext();
  if (!ctx.isOwner) return fail("Seul le propriétaire peut supprimer un client.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("customers").delete().eq("id", id).eq("store_id", ctx.storeId);
  if (error) return fail(toUserMessage(error));
  revalidatePath("/dashboard/customers");
  return ok(null, "Client supprimé.");
}
