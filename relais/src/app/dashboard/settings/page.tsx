import { requireStoreOwner } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { whatsappCloudStatus } from "@/lib/messaging";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Panel, PanelHeader, DescriptionList } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { TeamSettings } from "./team";
import { OperationsSettings } from "./operations";

export const metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  const ctx = await requireStoreOwner();
  const supabase = await createSupabaseServerClient();
  const [{ data: members }, { data: invites }, { data: store }] = await Promise.all([
    supabase.from("store_members").select("user_id, role, permissions, profiles(full_name, email)").eq("store_id", ctx.storeId).order("created_at"),
    supabase
      .from("invitations")
      .select("id, label, permissions, expires_at, created_at")
      .eq("store_id", ctx.storeId)
      .eq("kind", "staff")
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
    supabase.from("stores").select("id, created_at, courier_max_active_jobs, share_courier_phone, currency").eq("id", ctx.storeId).single(),
  ]);
  const wa = whatsappCloudStatus();

  return (
    <PageContainer size="narrow">
      <PageHeader title="Paramètres" description={ctx.store.name} />
      <div className="flex flex-col gap-6">
        <TeamSettings
          storeName={ctx.store.name}
          members={(members ?? []).map((m) => ({
            user_id: m.user_id,
            role: m.role,
            permissions: m.permissions,
            name: m.profiles?.full_name ?? "",
            email: m.profiles?.email ?? null,
            isMe: m.user_id === ctx.viewer.id,
          }))}
          invites={invites ?? []}
        />
        <OperationsSettings initial={{ courier_max_active_jobs: store?.courier_max_active_jobs ?? 1, share_courier_phone: store?.share_courier_phone ?? true }} />
        <Panel>
          <PanelHeader title="Intégrations" />
          <div className="px-5 py-2">
            <DescriptionList
              items={[
                {
                  label: "WhatsApp",
                  value: (
                    <span className="flex flex-col gap-1">
                      <span>
                        <Badge tone="success">Liens WhatsApp actifs</Badge>
                      </span>
                      <span className="text-xs text-ink-3">
                        Messages préremplis ouverts dans WhatsApp, envoyés par vous. Envoi automatique (WhatsApp Business API) :{" "}
                        {wa.configured ? "configuré au niveau de la plateforme." : "non configuré."}
                      </span>
                    </span>
                  ),
                },
                {
                  label: "Paiement mobile",
                  value: <span className="text-xs text-ink-3">Orange Money et MTN MoMo : confirmation manuelle. Aucune API de paiement n&apos;est connectée.</span>,
                },
                { label: "Devise", value: store?.currency === "XAF" ? "Franc CFA (XAF)" : store?.currency },
                { label: "Créée le", value: formatDate(store?.created_at) },
                { label: "Identifiant", value: <span className="font-mono text-xs">{store?.id}</span> },
              ]}
            />
          </div>
        </Panel>
      </div>
    </PageContainer>
  );
}
