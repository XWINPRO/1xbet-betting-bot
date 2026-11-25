"use client";

import { useI18n } from "@/i18n/client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, Phone, Truck, UserMinus, Users, XCircle } from "lucide-react";
import { assignCourierAction, cancelDeliveryJobAction, createDeliveryJobAction, unassignCourierAction } from "@/lib/actions/deliveries";
import { CourierPicker } from "@/components/delivery/courier-picker";
import { LiveCourierMap } from "@/components/delivery/live-courier-map";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { InputGroup, Textarea } from "@/components/ui/input";
import { CopyButton } from "@/components/ui/client-helpers";
import { Notice } from "@/components/ui/page";
import { WhatsAppButton } from "./order-actions";
import { JOB_STATUS, LIVE_JOB_STATUSES } from "@/lib/status";
import { formatPhone, telHref } from "@/lib/phone";
import { whatsappUrl, waMessages } from "@/lib/whatsapp";
import type { LatLng } from "@/lib/geo";
import type { BoardCourier, JobStatus } from "@/types/domain";

export type PanelJob = {
  id: string;
  reference: string;
  status: JobStatus;
  courier_id: string | null;
  courier_name: string | null;
  courier_phone: string | null;
  courier_position: { lat: number; lng: number; accuracy: number | null; at: string } | null;
  tracking_token: string;
  tracking_active: boolean;
  collect_amount: number;
  pickup: LatLng | null;
  pickup_address: string;
  dropoff: LatLng | null;
  dropoff_address: string;
  delivered_at: string | null;
  failed_at: string | null;
  cancelled_at: string | null;
  failure_reason: string | null;
  cancel_reason: string | null;
  proof_url: string | null;
  proof_note: string | null;
  proof_recipient_name: string | null;
  cash_collected: boolean;
};

export function DeliveryPanel({
  order,
  job,
  couriers,
  storePickup,
  siteUrl,
  storeName,
  canAssign,
  staleAfterSeconds,
  plan,
}: {
  order: { id: string; reference: string; status: string; delivery_mode: "delivery" | "pickup"; customer_name: string; customer_phone: string; total: number; currency: string; payment_status: string; payment_method: string; has_address: boolean };
  job: PanelJob | null;
  couriers: BoardCourier[];
  storePickup: LatLng | null;
  siteUrl: string;
  storeName: string;
  canAssign: boolean;
  staleAfterSeconds: number;
  /** Plan de la boutique : livreurs inclus et niveau de suivi. */
  plan: { tracking: "none" | "status" | "live"; maxCouriers: number; isOwner: boolean };
}) {
  const i18n = useI18n();
  const { t, f } = i18n;
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const defaultCollect = order.payment_status === "unpaid" && order.payment_method === "cash_on_delivery" ? order.total : 0;
  const [collect, setCollect] = React.useState(String(defaultCollect));
  const [instructions, setInstructions] = React.useState("");

  const closedOrder = ["delivered", "cancelled"].includes(order.status);
  const jobActive = job && !["delivered", "failed", "cancelled"].includes(job.status);
  const canCreate = order.delivery_mode === "delivery" && !closedOrder && !jobActive && canAssign;
  const trackingUrl = job ? `${siteUrl}/track/${job.tracking_token}` : null;

  async function createWith(courierId: string | null) {
    setPendingId(courierId ?? "none");
    const res = await createDeliveryJobAction(order.id, { courier_id: courierId, collect_amount: Number(collect) || 0, instructions: instructions || null });
    setPendingId(null);
    if (!res.ok) {
      toast.error(t(res.error));
      return;
    }
    toast.success(courierId ? t("Course {ref} envoyée au livreur.", { ref: res.data.reference }) : t("Course {ref} créée.", { ref: res.data.reference }));
    setPickerOpen(false);
    router.refresh();
  }

  async function assign(courierId: string) {
    if (!job) return createWith(courierId);
    setPendingId(courierId);
    const res = await assignCourierAction(job.id, courierId, order.id);
    setPendingId(null);
    if (!res.ok) return toast.error(t(res.error));
    toast.success(t(res.message ?? "Livreur attribué."));
    setPickerOpen(false);
    router.refresh();
  }

  if (order.delivery_mode === "pickup") {
    return (
      <Panel>
        <PanelHeader title={t("Livraison")} />
        <p className="px-5 py-4 text-[13px] text-ink-3">{t("Retrait en boutique : aucune course n'est nécessaire.")}</p>
      </Panel>
    );
  }

  const pickerDialog = (
    <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
      <DialogContent
        size="lg"
        title={job && jobActive ? t("Choisir un autre livreur") : t("Créer la livraison")}
        description={job && jobActive ? t("Course {ref}", { ref: job.reference }) : `${t("Commande {ref}", { ref: order.reference })} · ${order.customer_name}`}
        footer={
          !jobActive ? (
            <Button variant="secondary" loading={pendingId === "none"} onClick={() => createWith(null)}>
              {t("Créer sans attribuer")}
            </Button>
          ) : undefined
        }
      >
        {!jobActive ? (
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <Field label={t("Montant à encaisser par le livreur")} htmlFor="collect" hint={t("0 si la commande est déjà payée.")}>
              <InputGroup id="collect" type="number" min={0} suffix="FCFA" value={collect} onChange={(e) => setCollect(e.target.value)} />
            </Field>
            <Field label={t("Instructions pour le livreur")} htmlFor="instr" optional>
              <Textarea id="instr" rows={1} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
            </Field>
          </div>
        ) : null}
        <CourierPicker
          couriers={couriers}
          pickup={job?.pickup ?? storePickup}
          staleAfterSeconds={staleAfterSeconds}
          currentCourierId={jobActive ? job?.courier_id : null}
          onPick={(id) => void assign(id)}
          pendingId={pendingId}
          liveTracking={plan.tracking === "live"}
        />
      </DialogContent>
    </Dialog>
  );

  if (!job || (!jobActive && canCreate)) {
    return (
      <Panel>
        <PanelHeader title={t("Livraison")} />
        <div className="flex flex-col gap-3 px-5 py-4">
          {job ? (
            <Notice tone={job.status === "failed" ? "danger" : "neutral"} title={`${t("Course {ref}", { ref: job.reference })} : ${t(JOB_STATUS[job.status].label).toLowerCase()}`}>
              {t(job.failure_reason ?? job.cancel_reason ?? "") || null}
            </Notice>
          ) : null}
          {!order.has_address ? (
            <Notice tone="warning">{t("Ajoutez une adresse de livraison à la commande avant de créer la course.")}</Notice>
          ) : closedOrder ? (
            <p className="text-[13px] text-ink-3">{t("Commande clôturée.")}</p>
          ) : plan.maxCouriers === 0 ? (
            <Notice
              tone="accent"
              title={t("Pas de livreur dans votre plan")}
              action={
                plan.isOwner ? (
                  <Button asChild size="sm" variant="primary">
                    <Link href="/dashboard/billing">{t("Voir les plans")}</Link>
                  </Button>
                ) : null
              }
            >
              {t("Le plan gratuit ne permet pas de créer des courses. Passez à un plan avec livreurs pour livrer vos commandes et les suivre.")}
            </Notice>
          ) : canAssign ? (
            <>
              <p className="text-[13px] text-ink-3">{t("Créez la course et choisissez le livreur : il la reçoit dans son application et peut l'accepter.")}</p>
              <Button variant="primary" onClick={() => setPickerOpen(true)} className="self-start">
                <Truck /> {job ? t("Relancer une livraison") : t("Créer la livraison")}
              </Button>
            </>
          ) : (
            <p className="text-[13px] text-ink-3">{t("Aucune livraison planifiée.")}</p>
          )}
        </div>
        {pickerDialog}
      </Panel>
    );
  }

  const live = LIVE_JOB_STATUSES.includes(job.status) && job.tracking_active;
  const courierMissionUrl = `${siteUrl}/courier/jobs/${job.id}`;

  return (
    <Panel>
      <PanelHeader
        title={
          <span className="flex items-center gap-2">
            {t("Livraison")} <span className="font-mono text-[12.5px] font-normal text-ink-3">{job.reference}</span>
          </span>
        }
        actions={<StatusBadge map={JOB_STATUS} value={job.status} pulse={job.status === "in_transit"} />}
      />
      <div className="flex flex-col gap-4 px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink-3">{t("Livreur")}</p>
            {job.courier_name ? (
              <p className="text-[13.5px] font-medium text-ink">
                {job.courier_name}
                {job.status === "offered" ? <span className="ml-2 text-xs font-normal text-warning-ink">{t("en attente d'acceptation")}</span> : null}
              </p>
            ) : (
              <p className="text-[13.5px] text-warning-ink">{t("Aucun livreur attribué")}</p>
            )}
          </div>
          {job.courier_phone ? (
            <>
              <Button asChild size="sm" variant="secondary">
                <a href={telHref(job.courier_phone) ?? "#"}>
                  <Phone /> {formatPhone(job.courier_phone)}
                </a>
              </Button>
              <WhatsAppButton
                size="sm"
                label={t("Mission")}
                href={whatsappUrl(job.courier_phone, waMessages(i18n).courierMission({ reference: job.reference, pickup: job.pickup_address, dropoff: job.dropoff_address, collect: job.collect_amount, currency: order.currency, url: courierMissionUrl }))}
              />
            </>
          ) : null}
        </div>

        {jobActive && canAssign ? (
          <div className="flex flex-wrap gap-2">
            {["pending", "offered", "accepted"].includes(job.status) ? (
              <Button size="sm" variant={job.courier_id ? "secondary" : "primary"} onClick={() => setPickerOpen(true)}>
                <Users /> {job.courier_id ? t("Changer de livreur") : t("Attribuer un livreur")}
              </Button>
            ) : null}
            {["offered", "accepted"].includes(job.status) ? (
              <Button
                size="sm"
                variant="ghost"
                loading={pendingId === "unassign"}
                onClick={async () => {
                  setPendingId("unassign");
                  const res = await unassignCourierAction(job.id, order.id);
                  setPendingId(null);
                  if (!res.ok) toast.error(t(res.error));
                  else router.refresh();
                }}
              >
                <UserMinus /> {t("Retirer le livreur")}
              </Button>
            ) : null}
            <Button size="sm" variant="danger-ghost" onClick={() => setCancelOpen(true)}>
              <XCircle /> {t("Annuler la course")}
            </Button>
          </div>
        ) : null}

        {job.collect_amount > 0 ? (
          <p className="text-[13px] text-ink-2">
            {t("À encaisser à la livraison :")} <span className="font-medium tabular">{f.money(job.collect_amount, order.currency)}</span>
            {job.status === "delivered" ? ` · ${job.cash_collected ? t("encaissé par le livreur") : t("non déclaré encaissé")}` : ""}
          </p>
        ) : null}

        <div className="rounded-md border border-line bg-subtle p-3">
          <p className="text-xs font-medium text-ink-2">{t("Lien de suivi client")}</p>
          <p className="mt-1 truncate font-mono text-xs text-ink-3">{trackingUrl}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <CopyButton value={trackingUrl!} label={t("Copier le lien")} />
            <WhatsAppButton
              size="sm"
              label={t("Envoyer au client")}
              href={whatsappUrl(
                order.customer_phone,
                plan.tracking === "live"
                  ? waMessages(i18n).trackingLink({ storeName, customerName: order.customer_name, reference: order.reference, url: trackingUrl!, courierName: job.courier_name?.split(" ")[0] })
                  : waMessages(i18n).trackingSteps({ storeName, customerName: order.customer_name, reference: order.reference, url: trackingUrl! }),
              )}
            />
            <Button asChild size="sm" variant="ghost">
              <Link href={`/track/${job.tracking_token}`} target="_blank">
                {t("Ouvrir")} <ExternalLink />
              </Link>
            </Button>
          </div>
        </div>

        {plan.tracking === "live" ? (
        <LiveCourierMap
          jobId={job.id}
          courierId={job.courier_id}
          courierName={job.courier_name}
          initialPosition={job.courier_position}
          pickup={job.pickup}
          dropoff={job.dropoff}
          live={live}
          staleAfterSeconds={staleAfterSeconds}
          height={240}
        />
        ) : (
          <p className="rounded-md border border-line px-3 py-2.5 text-[12.5px] text-ink-3">
            {t("Votre plan affiche les étapes de la livraison (acceptée, récupérée, en route, livrée), sans la position du livreur.")}{" "}
            {plan.isOwner ? (
              <Link href="/dashboard/billing" className="font-medium text-accent hover:underline">
                {t("Passer au suivi GPS")}
              </Link>
            ) : null}
          </p>
        )}

        {job.status === "delivered" ? (
          <div className="flex gap-4 rounded-md border border-success/20 bg-success-soft/50 p-3 text-[13px]">
            {job.proof_url ? (
              <a href={job.proof_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={job.proof_url} alt={t("Preuve de livraison")} className="size-20 rounded-sm object-cover ring-1 ring-line" />
              </a>
            ) : null}
            <div>
              <p className="font-medium text-success">{t("Livrée le {date}", { date: f.dateTime(job.delivered_at) })}</p>
              {job.proof_recipient_name ? <p className="text-ink-2">{t("Remise à : {name}", { name: job.proof_recipient_name })}</p> : null}
              {job.proof_note ? <p className="text-ink-3">{job.proof_note}</p> : null}
              {!job.proof_url ? <p className="text-ink-3">{t("Aucune photo de preuve.")}</p> : null}
            </div>
          </div>
        ) : null}
      </div>
      {pickerDialog}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent
          size="sm"
          title={t("Annuler la course")}
          description={t("Le livreur est prévenu dans son application. La commande reste ouverte.")}
          footer={
            <>
              <Button variant="ghost" onClick={() => setCancelOpen(false)}>
                {t("Retour")}
              </Button>
              <Button
                variant="danger"
                loading={pendingId === "cancel"}
                onClick={async () => {
                  setPendingId("cancel");
                  const res = await cancelDeliveryJobAction(job.id, reason, order.id);
                  setPendingId(null);
                  if (!res.ok) return toast.error(t(res.error));
                  setCancelOpen(false);
                  router.refresh();
                }}
              >
                {t("Annuler la course")}
              </Button>
            </>
          }
        >
          <Field label={t("Motif")} htmlFor="job-cancel">
            <Textarea id="job-cancel" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
