import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapServices } from "@/lib/server-env";
import { whatsappCloudStatus } from "@/lib/messaging";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Panel, PanelHeader, DescriptionList } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { SettingRow } from "@/components/admin/setting-row";

export const metadata = { title: "Paramètres" };

const LABELS: Record<string, { label: string; unit?: string; group: string }> = {
  "location.active_interval_s": { label: "Fréquence GPS en course", unit: "s", group: "Géolocalisation" },
  "location.idle_interval_s": { label: "Fréquence GPS en attente", unit: "s", group: "Géolocalisation" },
  "location.stale_after_s": { label: "Position considérée obsolète après", unit: "s", group: "Géolocalisation" },
  "tracking.retention_days": { label: "Conservation de l'historique GPS", unit: "j", group: "Géolocalisation" },
  "courier.offline_after_s": { label: "Livreur hors ligne après", unit: "s", group: "Disponibilité" },
  "courier.auto_unavailable_after_s": { label: "Retour automatique en indisponible après", unit: "s", group: "Disponibilité" },
  "dispatch.platform_max_active_jobs": { label: "Courses simultanées (réseau)", group: "Dispatch" },
  "dispatch.open_pool_radius_km": { label: "Rayon des courses visibles", unit: "km", group: "Dispatch" },
  "on_demand.enabled": { label: "Livraisons ponctuelles activées", group: "Dispatch" },
};

export default async function AdminSettingsPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data: settings } = await supabase.from("platform_settings").select("*").order("key");
  const groups = new Map<string, typeof settings>();
  for (const s of settings ?? []) {
    const g = LABELS[s.key]?.group ?? "Autres";
    groups.set(g, [...(groups.get(g) ?? []), s]);
  }
  const wa = whatsappCloudStatus();

  return (
    <PageContainer size="narrow">
      <PageHeader title="Paramètres de la plateforme" description="Chaque modification est enregistrée dans le journal d'activité." />
      <div className="flex flex-col gap-6">
        {[...groups.entries()].map(([group, items]) => (
          <Panel key={group}>
            <PanelHeader title={group} />
            <div className="divide-y divide-line">
              {(items ?? []).map((s) => (
                <SettingRow
                  key={s.key}
                  settingKey={s.key}
                  label={LABELS[s.key]?.label ?? s.key}
                  unit={LABELS[s.key]?.unit}
                  description={s.description}
                  value={typeof s.value === "boolean" ? s.value : Number(s.value)}
                />
              ))}
            </div>
          </Panel>
        ))}
        <Panel>
          <PanelHeader title="Services externes" description="Configurés par variables d'environnement sur le serveur." />
          <div className="px-5 py-2">
            <DescriptionList
              items={[
                { label: "Fond de carte", value: <Badge tone="success">OpenStreetMap</Badge> },
                { label: "Recherche d'adresse", value: mapServices.geocoding ? <Badge tone="success">Configurée</Badge> : <Badge tone="neutral">Non configurée (GEOCODING_URL)</Badge> },
                { label: "Calcul d'itinéraire", value: mapServices.routing ? <Badge tone="success">Configuré</Badge> : <Badge tone="neutral">Non configuré (ROUTING_URL) — pas de trajet ni d&apos;heure d&apos;arrivée</Badge> },
                { label: "WhatsApp Business API", value: wa.configured ? <Badge tone="success">Configurée</Badge> : <Badge tone="neutral">Non configurée — liens wa.me utilisés</Badge> },
                { label: "Paiement mobile (API)", value: <Badge tone="neutral">Aucun prestataire connecté</Badge> },
              ]}
            />
          </div>
        </Panel>
      </div>
    </PageContainer>
  );
}
