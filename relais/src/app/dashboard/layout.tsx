import { AppShell, type ShellSection } from "@/components/layout/app-shell";
import { StoreSwitcher } from "@/components/layout/store-switcher";
import { getStoreContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { publicAssetUrl } from "@/lib/storage";
import { DashboardTopbar } from "./topbar";
import { msg } from "@/i18n/msg";
import { getI18n } from "@/i18n/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getStoreContext();
  const { t } = await getI18n();
  const supabase = await createSupabaseServerClient();
  const [{ count: newOrders }, { count: unassigned }] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("store_id", ctx.storeId).eq("status", "new"),
    supabase.from("delivery_jobs").select("id", { count: "exact", head: true }).eq("store_id", ctx.storeId).eq("status", "pending"),
  ]);

  const canSeeCatalog = ctx.can("products.view") || ctx.can("products.manage") || ctx.can("orders.create");
  const canSeeCustomers = ctx.can("customers.view") || ctx.can("orders.create") || ctx.can("orders.edit");
  const canDispatch = ctx.can("couriers.assign");

  const allSections: ShellSection[] = [
    {
      items: [
        { href: "/dashboard", label: msg("Vue d'ensemble"), icon: "overview", exact: true },
        { href: "/dashboard/orders", label: msg("Commandes"), icon: "orders", badge: newOrders ?? 0 },
        ...(canSeeCatalog ? [{ href: "/dashboard/products", label: msg("Produits"), icon: "products" as const }] : []),
        ...(canSeeCustomers ? [{ href: "/dashboard/customers", label: msg("Clients"), icon: "customers" as const }] : []),
      ],
    },
    {
      title: msg("Logistique"),
      items: [
        { href: "/dashboard/deliveries", label: msg("Livraisons"), icon: "deliveries", badge: unassigned ?? 0 },
        ...(canDispatch ? [{ href: "/dashboard/couriers", label: msg("Livreurs"), icon: "couriers" as const }] : []),
      ],
    },
    {
      title: msg("Boutique"),
      items: [
        ...(ctx.isOwner ? [{ href: "/dashboard/storefront", label: msg("Boutique en ligne"), icon: "storefront" as const }] : []),
        ...(ctx.can("stats.view") ? [{ href: "/dashboard/stats", label: msg("Statistiques"), icon: "stats" as const }] : []),
        ...(ctx.isOwner ? [{ href: "/dashboard/billing", label: msg("Abonnement"), icon: "billing" as const }] : []),
        ...(ctx.isOwner ? [{ href: "/dashboard/settings", label: msg("Paramètres"), icon: "settings" as const }] : []),
      ],
    },
  ];
  const sections = allSections.filter((s) => s.items.length > 0);

  const stores = ctx.viewer.memberships.map((m) => ({
    id: m.store_id,
    name: m.stores!.name,
    role: m.role,
    logoUrl: publicAssetUrl(m.stores!.logo_path),
  }));

  return (
    <AppShell
      homeHref="/dashboard"
      sections={sections}
      user={{
        name: ctx.viewer.profile.full_name,
        email: ctx.viewer.email,
        isAdmin: ctx.viewer.isAdmin,
        isCourier: Boolean(ctx.viewer.courier),
      }}
      header={<StoreSwitcher stores={stores} activeId={ctx.storeId} />}
      topbar={<DashboardTopbar shopUrl={ctx.store.is_published ? `/shop/${ctx.store.slug}` : null} canCreateOrder={ctx.can("orders.create")} />}
    >
      {ctx.store.status === "suspended" ? (
        <div className="border-b border-danger/20 bg-danger-soft px-4 py-2.5 text-center text-[13px] text-danger-ink sm:px-6">
          {t("Cette boutique est suspendue par l'administration : la page publique et la création de commandes sont désactivées.")}
        </div>
      ) : null}
      {children}
    </AppShell>
  );
}
