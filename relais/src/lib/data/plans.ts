import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Plan } from "@/types/domain";

/** Plans visibles (prix et limites définis par l'administration). */
export const getPublicPlans = cache(async (): Promise<Plan[]> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("plans").select("*").eq("is_public", true).order("sort_order");
  return data ?? [];
});
