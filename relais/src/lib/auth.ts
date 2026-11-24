import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import type { StaffPermission } from "@/lib/permissions";

export const STORE_COOKIE = "relais_store";

/**
 * Utilisateur courant + rattachements (boutiques, profil livreur).
 * Mis en cache pour la durée d'une requête.
 */
export const getViewer = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  const [profileRes, membershipsRes, courierRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase
      .from("store_members")
      .select("store_id, role, permissions, stores(id, name, slug, logo_path, status, is_published, currency)")
      .eq("user_id", userId)
      .order("created_at"),
    supabase
      .from("couriers")
      .select("id, kind, full_name, phone, account_status, availability, vehicle_type")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (!profileRes.data) return null;

  const memberships = (membershipsRes.data ?? []).filter((m) => m.stores !== null);
  return {
    id: userId,
    email: profileRes.data.email,
    profile: profileRes.data,
    memberships,
    courier: courierRes.data,
    isAdmin: profileRes.data.is_platform_admin && !profileRes.data.is_suspended,
  };
});

export type Viewer = NonNullable<Awaited<ReturnType<typeof getViewer>>>;
export type Membership = Viewer["memberships"][number];

export function homePathFor(viewer: Viewer): string {
  if (viewer.memberships.length > 0) return "/dashboard";
  if (viewer.courier) return "/courier";
  if (viewer.isAdmin) return "/admin";
  return "/onboarding";
}

export async function requireViewer(next = "/") {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (viewer.profile.is_suspended) redirect("/suspended");
  return viewer;
}

export async function requireAdmin() {
  const viewer = await requireViewer("/admin");
  if (!viewer.isAdmin) redirect(homePathFor(viewer));
  return viewer;
}

export type StoreContext = Awaited<ReturnType<typeof getStoreContext>>;

/** Boutique active (cookie) parmi celles de l'utilisateur. */
export const getStoreContext = cache(async () => {
  const viewer = await requireViewer("/dashboard");
  if (viewer.memberships.length === 0) redirect("/onboarding");
  const cookieStore = await cookies();
  const preferred = cookieStore.get(STORE_COOKIE)?.value;
  const membership = viewer.memberships.find((m) => m.store_id === preferred) ?? viewer.memberships[0];
  const isOwner = membership.role === "owner";
  const permissions = membership.permissions ?? [];
  const can = (perm: StaffPermission) => isOwner || permissions.includes(perm);
  return {
    viewer,
    membership,
    storeId: membership.store_id,
    store: membership.stores!,
    isOwner,
    permissions,
    can,
  };
});

export async function requireStorePermission(perm: StaffPermission) {
  const ctx = await getStoreContext();
  if (!ctx.can(perm)) redirect("/dashboard?denied=1");
  return ctx;
}

export async function requireStoreOwner() {
  const ctx = await getStoreContext();
  if (!ctx.isOwner) redirect("/dashboard?denied=1");
  return ctx;
}

export async function requireCourier() {
  const viewer = await requireViewer("/courier");
  if (!viewer.courier) redirect("/courier/apply");
  return { viewer, courier: viewer.courier };
}

/** URL absolue du site (variable d'environnement, sinon en-têtes de la requête). */
export async function getSiteUrl(): Promise<string> {
  if (env.siteUrl) return env.siteUrl;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
