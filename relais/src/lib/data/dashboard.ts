import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";

export type StoreStats = {
  can_view_revenue: boolean;
  revenue: number | null;
  collected: number | null;
  pending_cash: number | null;
  avg_order_value: number | null;
  orders_count: number;
  cancelled_count: number;
  pending_orders: number;
  new_orders: number;
  active_deliveries: number;
  unassigned_deliveries: number;
  delivered_count: number;
  failed_count: number;
  available_couriers: number;
  couriers_total: number;
};

export async function getStoreStats(supabase: ServerSupabase, storeId: string, from: Date, to: Date) {
  const { data, error } = await supabase.rpc("store_dashboard_stats", {
    p_store_id: storeId,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) throw error;
  return data as unknown as StoreStats;
}

export async function getSetupChecklist(supabase: ServerSupabase, storeId: string) {
  const [store, products, couriers, orders] = await Promise.all([
    supabase.from("stores").select("address, lat, lng, is_published, logo_path, whatsapp, phone").eq("id", storeId).single(),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId),
    supabase.from("courier_store_memberships").select("courier_id", { count: "exact", head: true }).eq("store_id", storeId),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("store_id", storeId),
  ]);
  const s = store.data;
  return {
    location: Boolean(s?.address && s?.lat !== null && s?.lng !== null),
    products: (products.count ?? 0) > 0,
    couriers: (couriers.count ?? 0) > 0,
    published: Boolean(s?.is_published),
    orders: (orders.count ?? 0) > 0,
  };
}
