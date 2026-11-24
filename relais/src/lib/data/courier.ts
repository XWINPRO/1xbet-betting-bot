import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCourier } from "@/lib/auth";
import type { EffectiveCourierStatus } from "@/types/domain";

export const getCourierHome = cache(async () => {
  const { viewer, courier } = await requireCourier();
  const supabase = await createSupabaseServerClient();
  const [{ data: full }, { data: jobs }, { data: settings }, { data: stores }] = await Promise.all([
    supabase.from("couriers").select("*").eq("id", courier.id).single(),
    supabase
      .from("delivery_jobs")
      .select("id, reference, status, source, pickup_name, pickup_address, dropoff_name, dropoff_address, collect_amount, price, currency, offered_at, accepted_at, store_id, stores(name)")
      .eq("courier_id", courier.id)
      .in("status", ["offered", "accepted", "picked_up", "in_transit"])
      .order("offered_at", { ascending: true }),
    supabase.rpc("courier_settings"),
    supabase.from("courier_store_memberships").select("status, stores(id, name, courier_max_active_jobs)").eq("courier_id", courier.id),
  ]);
  const s = (settings ?? {}) as { active_interval_s?: number; idle_interval_s?: number; stale_after_s?: number; offline_after_s?: number };
  const active = (jobs ?? []).filter((j) => j.status !== "offered");
  const offers = (jobs ?? []).filter((j) => j.status === "offered");
  const c = full!;
  const maxJobs = Math.max(1, ...((stores ?? []).map((m) => m.stores?.courier_max_active_jobs ?? 1)));
  const offline = !c.last_seen_at || Date.now() - new Date(c.last_seen_at).getTime() > (s.offline_after_s ?? 180) * 1000;
  const effective: EffectiveCourierStatus =
    c.account_status !== "active" ? "inactive" : active.length >= maxJobs ? "busy" : c.availability === "unavailable" ? "unavailable" : offline ? "offline" : "available";
  return {
    viewer,
    courier: c,
    active,
    offers,
    stores: stores ?? [],
    effective,
    settings: {
      active_interval_s: s.active_interval_s ?? 10,
      idle_interval_s: s.idle_interval_s ?? 60,
      stale_after_s: s.stale_after_s ?? 120,
    },
  };
});
