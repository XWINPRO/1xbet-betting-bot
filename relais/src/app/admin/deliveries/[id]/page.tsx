import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { toLatLng } from "@/lib/geo";
import { CLAIM_CATEGORY, CLAIM_STATUS, JOB_STATUS, PACKAGE_TYPES, PAYMENT_METHOD, PAYMENT_STATUS, TRANSACTION_STATUS } from "@/lib/status";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Panel, PanelHeader, DescriptionList } from "@/components/ui/panel";
import { StatusBadge, Tag } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/client-helpers";
import { LiveCourierMap } from "@/components/delivery/live-courier-map";
import { RealtimeRefresher } from "@/components/realtime/realtime-refresher";
import { JobAdminActions } from "@/components/admin/job-admin-actions";
import { getSiteUrl } from "@/lib/auth";
import type { AdminBoardCourier, BoardCourier, JobStatus } from "@/types/domain";

export const metadata = { title: "Course" };

const EVENT_LABEL: Record<string, string> = {
  created: "Course créée",
  status_changed: "Statut",
  courier_assigned: "Proposée à",
  courier_unassigned: "Livreur retiré",
  offer_declined: "Proposition refusée",
  issue_reported: "Problème signalé",
  recipient_confirmed: "Réception confirmée par le destinataire",
};

export default async function AdminJobPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: job } = await supabase
    .from("delivery_jobs")
    .select("*, stores(name, slug, phone), couriers(id, full_name, phone, kind, last_lat, last_lng, last_accuracy, last_location_at), orders!delivery_jobs_order_id_fkey(reference)")
    .eq("id", id)
    .maybeSingle();
  if (!job) notFound();
  const [{ data: events }, { data: assignments }, { data: txs }, { data: claims }, { data: board }, { data: stale }] = await Promise.all([
    supabase.from("delivery_events").select("*").eq("job_id", id).order("created_at"),
    supabase.from("delivery_assignments").select("*, couriers(full_name)").eq("job_id", id).order("offered_at"),
    supabase.from("transactions").select("*").eq("job_id", id).order("created_at"),
    supabase.from("claims").select("id, reference, category, status, description, created_at").eq("job_id", id).order("created_at"),
    supabase.rpc("admin_courier_board", { p_kind: "platform" }),
    supabase.from("platform_settings").select("value").eq("key", "location.stale_after_s").maybeSingle(),
  ]);
  const site = await getSiteUrl();
  const trackingUrl = `${site}/track/${job.tracking_token}`;
  const staleAfter = Number(stale?.value ?? 120);
  const couriers = ((board ?? []) as AdminBoardCourier[])
    .filter((c) => c.account_status === "active")
    .map((c) => ({
      courier_id: c.courier_id,
      full_name: c.full_name,
      phone: c.phone,
      kind: c.kind,
      vehicle_type: c.vehicle_type,
      vehicle_plate: null,
      zone: c.zone,
      zone_lat: null,
      zone_lng: null,
      zone_radius_km: null,
      account_status: c.account_status,
      membership_status: "active",
      availability: c.availability,
      effective_status: c.effective_status,
      active_jobs: c.active_jobs,
      active_jobs_here: 0,
      last_seen_at: c.last_seen_at,
      last_lat: c.last_lat,
      last_lng: c.last_lng,
      last_accuracy: null,
      last_location_at: c.last_location_at,
      linked: true,
      delivered_30d: c.delivered_total,
      created_at: c.created_at,
    })) as unknown as BoardCourier[];
  const pickup = toLatLng(job.pickup_lat, job.pickup_lng);
  const c = job.couriers;

  return (
    <PageContainer>
      <RealtimeRefresher channel={`admin-job-${id}`} tables={["delivery_jobs"]} filter={`id=eq.${id}`} />
      <PageHeader
        back={{ href: "/admin/deliveries", label: "Courses" }}
        title={<span className="font-mono">{job.reference}</span>}
        meta={
          <>
            <StatusBadge map={JOB_STATUS} value={job.status as JobStatus} />
            <Tag>{job.source === "on_demand" ? "Ponctuelle" : `Boutique · ${job.stores?.name ?? ""}`}</Tag>
          </>
        }
        description={`Créée le ${formatDateTime(job.created_at)}${job.orders?.reference ? ` · commande ${job.orders.reference}` : ""}`}
        actions={
          <JobAdminActions
            jobId={job.id}
            status={job.status}
            courierId={job.courier_id}
            couriers={couriers}
            pickup={pickup}
            staleAfterSeconds={staleAfter}
            source={job.source}
            price={Number(job.price)}
            paymentStatus={job.payment_status}
          />
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel>
            <PanelHeader title="Parties concernées" />
            <div className="px-5 py-2">
              <DescriptionList
                items={[
                  job.source === "on_demand"
                    ? { label: "Demandeur", value: `${job.requester_name ?? "—"} · ${formatPhone(job.requester_phone)}` }
                    : { label: "Boutique", value: `${job.stores?.name ?? "—"}${job.stores?.phone ? ` · ${formatPhone(job.stores.phone)}` : ""}` },
                  { label: "Collecte", value: `${job.pickup_name ?? ""} — ${job.pickup_address}${job.pickup_phone ? ` · ${formatPhone(job.pickup_phone)}` : ""}` },
                  { label: "Destinataire", value: `${job.dropoff_name} · ${formatPhone(job.dropoff_phone)}` },
                  { label: "Destination", value: job.dropoff_address },
                  { label: "Livreur", value: c ? `${c.full_name} · ${formatPhone(c.phone)} (${c.kind === "platform" ? "réseau" : "boutique"})` : <span className="text-warning-ink">Non attribué</span> },
                  { label: "Colis", value: [job.package_type ? PACKAGE_TYPES[job.package_type] : null, job.package_description].filter(Boolean).join(" — ") || "—" },
                  ...(job.instructions ? [{ label: "Instructions", value: job.instructions }] : []),
                  { label: "Distance", value: job.distance_km ? `${String(job.distance_km).replace(".", ",")} km (à vol d'oiseau)` : "—" },
                  { label: "Prix", value: formatMoney(job.price, job.currency) },
                  { label: "À encaisser", value: Number(job.collect_amount) > 0 ? `${formatMoney(job.collect_amount, job.currency)}${job.cash_collected ? " · déclaré encaissé" : ""}` : "—" },
                  { label: "Paiement", value: <span className="flex items-center gap-2">{PAYMENT_METHOD[job.payment_method]} <StatusBadge map={PAYMENT_STATUS} value={job.payment_status} /></span> },
                  ...(job.failure_reason ? [{ label: "Motif d'échec", value: job.failure_reason }] : []),
                  ...(job.cancel_reason ? [{ label: "Motif d'annulation", value: job.cancel_reason }] : []),
                ]}
              />
            </div>
          </Panel>
          <Panel>
            <PanelHeader title="Chronologie" />
            <ol className="px-5 py-3">
              {(events ?? []).map((e) => (
                <li key={e.id} className="flex gap-3 py-1.5 text-[13px]">
                  <span className="w-32 shrink-0 text-xs text-ink-3 tabular">{formatDateTime(e.created_at)}</span>
                  <span>
                    {EVENT_LABEL[e.type] ?? e.type}
                    {e.type === "status_changed" && e.status ? ` : ${JOB_STATUS[e.status as JobStatus].label}` : ""}
                    {e.message ? <span className="text-ink-3"> — {e.type === "issue_reported" ? CLAIM_CATEGORY[e.message] ?? e.message : e.message}</span> : null}
                    {e.lat != null ? <span className="text-xs text-ink-4"> (position enregistrée)</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          </Panel>
          {assignments?.length ? (
            <Panel>
              <PanelHeader title="Propositions aux livreurs" />
              <ul className="divide-y divide-line">
                {assignments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between px-5 py-2.5 text-[13px]">
                    <span>{a.couriers?.full_name}</span>
                    <span className="text-xs text-ink-3">
                      {{ offered: "Proposée", accepted: "Acceptée", declined: "Refusée", revoked: "Retirée" }[a.status]} · {formatDateTime(a.responded_at ?? a.offered_at)}
                      {a.note ? ` · ${a.note}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
        <div className="flex flex-col gap-6">
          <Panel className="overflow-hidden">
            <PanelHeader title="Suivi" />
            <div className="p-4">
              <LiveCourierMap
                courierId={job.courier_id}
                courierName={c?.full_name}
                initialPosition={c?.last_lat != null && c?.last_lng != null && c.last_location_at ? { lat: c.last_lat, lng: c.last_lng, accuracy: c.last_accuracy, at: c.last_location_at } : null}
                pickup={pickup}
                dropoff={toLatLng(job.dropoff_lat, job.dropoff_lng)}
                live={["accepted", "picked_up", "in_transit"].includes(job.status) && job.tracking_active}
                staleAfterSeconds={staleAfter}
                height={240}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyButton value={trackingUrl} label="Copier le lien de suivi" />
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/track/${job.tracking_token}`} target="_blank">
                    Ouvrir <ExternalLink />
                  </Link>
                </Button>
              </div>
            </div>
          </Panel>
          <Panel>
            <PanelHeader title="Transactions" />
            {txs?.length ? (
              <ul className="divide-y divide-line">
                {txs.map((t) => (
                  <li key={t.id} className="flex items-center justify-between px-5 py-2.5 text-[13px]">
                    <span>
                      {formatMoney(t.amount, t.currency)} · {PAYMENT_METHOD[t.method]}
                    </span>
                    <StatusBadge map={TRANSACTION_STATUS} value={t.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-[13px] text-ink-3">Aucune transaction.</p>
            )}
          </Panel>
          <Panel>
            <PanelHeader title="Réclamations" />
            {claims?.length ? (
              <ul className="divide-y divide-line">
                {claims.map((cl) => (
                  <li key={cl.id} className="px-5 py-2.5 text-[13px]">
                    <div className="flex items-center justify-between">
                      <Link href={`/admin/claims?q=${cl.reference}`} className="font-mono text-xs hover:text-accent">
                        {cl.reference}
                      </Link>
                      <StatusBadge map={CLAIM_STATUS} value={cl.status} />
                    </div>
                    <p className="text-ink-2">{CLAIM_CATEGORY[cl.category]}</p>
                    <p className="text-xs text-ink-3">{cl.description}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-[13px] text-ink-3">Aucune réclamation.</p>
            )}
          </Panel>
        </div>
      </div>
    </PageContainer>
  );
}
