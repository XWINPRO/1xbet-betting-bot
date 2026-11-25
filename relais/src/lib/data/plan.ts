import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PlanInfo } from "@/types/domain";

const FREE: PlanInfo = { code: "free", tracking: "none", max_couriers: 0, max_staff: 0, couriers_used: 0, staff_used: 0, ends_at: null, pending: false };

/** Plan en vigueur de la boutique et utilisation (livreurs, employés). */
export const getStorePlan = cache(async (storeId: string): Promise<PlanInfo> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("store_plan_info", { p_store_id: storeId });
  return (data as PlanInfo | null) ?? FREE;
});
