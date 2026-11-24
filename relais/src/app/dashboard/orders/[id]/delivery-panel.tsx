"use client";

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
import { formatDateTime, formatMoney } from "@/lib/format";
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
}: {
  order: { id: string; reference: string; status: string; delivery_mode: "delivery" | "pickup"; customer_name: string; customer_phone: string; total: number; currency: string; payment_status: string; payment_method: string; has_address: boolean };
  job: PanelJob | null;
  couriers: BoardCourier[];
  storePickup: LatLng | null;
  siteUrl: string;
  storeName: string;
  canAssign: boolean;
  staleAfterSeconds: number;
}) {
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
      toast.error(res.error);
      return;
    }
    toast.success(courierId ? `Course ${res.data.reference} envoyée au livreur.` : `Course ${res.data.reference} créée.`);
    setPickerOpen(false);
    router.refresh();
  }

  async function assign(courierId: string) {
    if (!job) return createWith(courierId);
    setPendingId(courierId);
    const res = await assignCourierAction(job.id, courierId, order.id);
    setPendingId(null);
    if (!res.ok) return toast.error(res.error);
    toast.success(res.message ?? "Livreur attribué.");
    setPickerOpen(false);
    router.refresh();
  }

  if (order.delivery_mode === "pickup") {
    return (
      <Panel>
        <PanelHeader title="Livraison" />
        <p className="px-5 py-4 text-[13px] text-ink-3">Retrait en boutique : aucune course n&apos;est nécessaire.</p>
      </Panel>
    );
  }

  const pickerDialog = (
    <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
      <DialogContent
        size="lg"
        title={job && jobActive ? "Choisir un autre livreur" : "Créer la livraison"}
        description={job && jobActive ? `Course ${job.reference}` : `Commande ${order.reference} · ${order.customer_name}`}
        footer={
          !jobActive ? (
            <Button variant="secondary" loading={pendingId === "none"} onClick={() => createWith(null)}>
              Créer sans attribuer
            </Button>
          ) : undefined
        }
      >
        {!jobActive ? (
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <Field label="Montant à encaisser par le livreur" htmlFor="collect" hint="0 si la commande est déjà payée.">
              <InputGroup id="collect" type="number" min={0} suffix="FCFA" value={collect} onChange={(e) => setCollect(e.target.value)} />
            </Field>
            <Field label="Instructions pour le livreur" htmlFor="instr" optional>
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
        />
      </DialogContent>
    </Dialog>
  );

  if (!job || (!jobActive && canCreate)) {
    return (
      <Panel>
        <PanelHeader title="Livraison" />
        <div className="flex flex-col gap-3 px-5 py-4">
          {job ? (
            <Notice tone={job.status === "failed" ? "danger" : "neutral"} title={`Course ${job.reference} : ${JOB_STATUS[job.status].label.toLowerCase()}`}>
              {job.failure_reason ?? job.cancel_reason ?? null}
            </Notice>
          ) : null}
          {!order.has_address ? (
            <Notice tone="warning">Ajoutez une adresse de livraison à la commande avant de créer la course.</Notice>
          ) : closedOrder ? (
            <p className="text-[13px] text-ink-3">Commande clôturée.</p>
          ) : canAssign ? (
            <>
              <p className="text-[13px] text-ink-3">Créez la course et choisissez le livreur : il la reçoit dans son application et peut l&apos;accepter.</p>
              <Button variant="primary" onClick={() => setPickerOpen(true)} className="self-start">
                <Truck /> {job ? "Relancer une livraison" : "Créer la livraison"}
              </Button>
            </>
          ) : (
            <p className="text-[13px] text-ink-3">Aucune livraison planifiée.</p>
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
            Livraison <span className="font-mono text-[12.5px] font-normal text-ink-3">{job.reference}</span>
          </span>
        }
        actions={<StatusBadge map={JOB_STATUS} value={job.status} pulse={job.status === "in_transit"} />}
      />
      <div className="flex flex-col gap-4 px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink-3">Livreur</p>
            {job.courier_name ? (
              <p className="text-[13.5px] font-medium text-ink">
                {job.courier_name}
                {job.status === "offered" ? <span className="ml-2 text-xs font-normal text-warning-ink">en attente d&apos;acceptation</span> : null}
              </p>
            ) : (
              <p className="text-[13.5px] text-warning-ink">Aucun livreur attribué</p>
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
                label="Mission"
                href={whatsappUrl(job.courier_phone, waMessages.courierMission({ reference: job.reference, pickup: job.pickup_address, dropoff: job.dropoff_address, collect: job.collect_amount, currency: order.currency, url: courierMissionUrl }))}
              />
            </>
          ) : null}
        </div>

        {jobActive && canAssign ? (
          <div className="flex flex-wrap gap-2">
            {["pending", "offered", "accepted"].includes(job.status) ? (
              <Button size="sm" variant={job.courier_id ? "secondary" : "primary"} onClick={() => setPickerOpen(true)}>
                <Users /> {job.courier_id ? "Changer de livreur" : "Attribuer un livreur"}
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
                  if (!res.ok) toast.error(res.error);
                  else router.refresh();
                }}
              >
                <UserMinus /> Retirer le livreur
              </Button>
            ) : null}
            <Button size="sm" variant="danger-ghost" onClick={() => setCancelOpen(true)}>
              <XCircle /> Annuler la course
            </Button>
          </div>
        ) : null}

        {job.collect_amount > 0 ? (
          <p className="text-[13px] text-ink-2">
            À encaisser à la livraison : <span className="font-medium tabular">{formatMoney(job.collect_amount, order.currency)}</span>
            {job.status === "delivered" ? (job.cash_collected ? " · encaissé par le livreur" : " · non déclaré encaissé") : ""}
          </p>
        ) : null}

        <div className="rounded-md border border-line bg-subtle p-3">
          <p className="text-xs font-medium text-ink-2">Lien de suivi client</p>
          <p className="mt-1 truncate font-mono text-xs text-ink-3">{trackingUrl}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <CopyButton value={trackingUrl!} label="Copier le lien" />
            <WhatsAppButton
              size="sm"
              label="Envoyer au client"
              href={whatsappUrl(order.customer_phone, waMessages.trackingLink({ storeName, customerName: order.customer_name, reference: order.reference, url: trackingUrl!, courierName: job.courier_name?.split(" ")[0] }))}
            />
            <Button asChild size="sm" variant="ghost">
              <Link href={`/track/${job.tracking_token}`} target="_blank">
                Ouvrir <ExternalLink />
              </Link>
            </Button>
          </div>
        </div>

        <LiveCourierMap
          courierId={job.courier_id}
          courierName={job.courier_name}
          initialPosition={job.courier_position}
          pickup={job.pickup}
          dropoff={job.dropoff}
          live={live}
          staleAfterSeconds={staleAfterSeconds}
          height={240}
        />

        {job.status === "delivered" ? (
          <div className="flex gap-4 rounded-md border border-success/20 bg-success-soft/50 p-3 text-[13px]">
            {job.proof_url ? (
              <a href={job.proof_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={job.proof_url} alt="Preuve de livraison" className="size-20 rounded-sm object-cover ring-1 ring-line" />
              </a>
            ) : null}
            <div>
              <p className="font-medium text-success">Livrée le {formatDateTime(job.delivered_at)}</p>
              {job.proof_recipient_name ? <p className="text-ink-2">Remise à : {job.proof_recipient_name}</p> : null}
              {job.proof_note ? <p className="text-ink-3">{job.proof_note}</p> : null}
              {!job.proof_url ? <p className="text-ink-3">Aucune photo de preuve.</p> : null}
            </div>
          </div>
        ) : null}
      </div>
      {pickerDialog}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent
          size="sm"
          title="Annuler la course"
          description="Le livreur est prévenu dans son application. La commande reste ouverte."
          footer={
            <>
              <Button variant="ghost" onClick={() => setCancelOpen(false)}>
                Retour
              </Button>
              <Button
                variant="danger"
                loading={pendingId === "cancel"}
                onClick={async () => {
                  setPendingId("cancel");
                  const res = await cancelDeliveryJobAction(job.id, reason, order.id);
                  setPendingId(null);
                  if (!res.ok) return toast.error(res.error);
                  setCancelOpen(false);
                  router.refresh();
                }}
              >
                Annuler la course
              </Button>
            </>
          }
        >
          <Field label="Motif" htmlFor="job-cancel">
            <Textarea id="job-cancel" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
