import { AppShell, type ShellSection } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: { default: "Administration", template: "%s · Administration" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const [{ count: applications }, { count: pendingJobs }, { count: claims }, { count: txs }] = await Promise.all([
    supabase.from("couriers").select("id", { count: "exact", head: true }).eq("account_status", "pending_review"),
    supabase.from("delivery_jobs").select("id", { count: "exact", head: true }).eq("source", "on_demand").eq("status", "pending"),
    supabase.from("claims").select("id", { count: "exact", head: true }).in("status", ["open", "investigating"]),
    supabase.from("transactions").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const sections: ShellSection[] = [
    { items: [{ href: "/admin", label: "Vue globale", icon: "overview", exact: true }] },
    {
      title: "Activité",
      items: [
        { href: "/admin/deliveries", label: "Courses", icon: "deliveries", badge: pendingJobs ?? 0 },
        { href: "/admin/orders", label: "Commandes", icon: "orders" },
        { href: "/admin/payments", label: "Paiements", icon: "payments", badge: txs ?? 0 },
        { href: "/admin/claims", label: "Réclamations", icon: "claims", badge: claims ?? 0 },
      ],
    },
    {
      title: "Comptes",
      items: [
        { href: "/admin/couriers", label: "Livreurs", icon: "couriers", badge: applications ?? 0 },
        { href: "/admin/stores", label: "Boutiques", icon: "storefront" },
        { href: "/admin/users", label: "Utilisateurs", icon: "users" },
      ],
    },
    {
      title: "Plateforme",
      items: [
        { href: "/admin/pricing", label: "Tarification", icon: "pricing" },
        { href: "/admin/settings", label: "Paramètres", icon: "settings" },
        { href: "/admin/logs", label: "Journal d'activité", icon: "logs" },
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
          <span className="text-[13px] font-medium">Administration</span>
          <Badge tone="accent" dot={false}>Plateforme</Badge>
        </div>
      }
      topbar={viewer.memberships.length ? <a href="/dashboard" className="text-[13px] text-ink-3 hover:text-ink">Espace boutique →</a> : null}
    >
      {children}
    </AppShell>
  );
}
