import type { Metadata } from "next";
import { AppShell, type ShellSection } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { msg } from "@/i18n/msg";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { default: t("Administration"), template: `%s · ${t("Administration")}` } };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireAdmin();
  const { t } = await getI18n();
  const supabase = await createSupabaseServerClient();
  const [{ count: subscriptions }, { count: claims }, { count: txs }] = await Promise.all([
    supabase.from("store_subscriptions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("claims").select("id", { count: "exact", head: true }).in("status", ["open", "investigating"]),
    supabase.from("transactions").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const sections: ShellSection[] = [
    { items: [{ href: "/admin", label: msg("Vue globale"), icon: "overview", exact: true }] },
    {
      title: msg("Abonnements"),
      items: [
        { href: "/admin/subscriptions", label: msg("Demandes et abonnements"), icon: "billing", badge: subscriptions ?? 0 },
        { href: "/admin/plans", label: msg("Plans"), icon: "plans" },
      ],
    },
    {
      title: msg("Activité"),
      items: [
        { href: "/admin/deliveries", label: msg("Livraisons"), icon: "deliveries" },
        { href: "/admin/orders", label: msg("Commandes"), icon: "orders" },
        { href: "/admin/payments", label: msg("Paiements"), icon: "payments", badge: txs ?? 0 },
        { href: "/admin/claims", label: msg("Réclamations"), icon: "claims", badge: claims ?? 0 },
      ],
    },
    {
      title: msg("Comptes"),
      items: [
        { href: "/admin/stores", label: msg("Boutiques"), icon: "storefront" },
        { href: "/admin/couriers", label: msg("Livreurs"), icon: "couriers" },
        { href: "/admin/users", label: msg("Utilisateurs"), icon: "users" },
      ],
    },
    {
      title: msg("Plateforme"),
      items: [
        { href: "/admin/settings", label: msg("Paramètres"), icon: "settings" },
        { href: "/admin/logs", label: msg("Journal d'activité"), icon: "logs" },
      ],
    },
  ];
  return (
    <AppShell
      homeHref="/admin"
      sections={sections}
      user={{ name: viewer.profile.full_name, email: viewer.email, isAdmin: true, isCourier: Boolean(viewer.courier) }}
      header={
        <div className="flex items-center justify-between rounded-md border border-line bg-subtle px-2.5 py-1.5">
          <span className="text-[13px] font-medium">{t("Administration")}</span>
          <Badge tone="accent" dot={false}>{t("Plateforme")}</Badge>
        </div>
      }
      topbar={viewer.memberships.length ? <a href="/dashboard" className="text-[13px] text-ink-3 hover:text-ink">{t("Espace boutique →")}</a> : null}
    >
      {children}
    </AppShell>
  );
}
