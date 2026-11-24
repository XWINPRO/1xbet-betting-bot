"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, CircleAlert, Clock, MapPinOff, Phone, RefreshCw } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cancelOnDemandAction, confirmReceiptAction, submitClaimAction } from "@/lib/actions/public";
import { MapView } from "@/components/map";
import { useRoute } from "@/components/map/use-route";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Notice } from "@/components/ui/page";
import { formatDateTime, formatDuration, formatMoney, formatTime } from "@/lib/format";
import { telHref } from "@/lib/phone";
import { toLatLng } from "@/lib/geo";
import { CLAIM_CATEGORY, PAYMENT_METHOD, TRACKING_STEPS, VEHICLES } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { TrackingPayload } from "@/types/domain";

const HEADLINE: Record<string, string> = {
  pending: "Recherche d'un livreur",
  offered: "Un livreur va prendre en charge votre colis",
  accepted: "Le livreur se rend au point de collecte",
  picked_up: "Colis récupéré",
  in_transit: "Votre livreur est en route",
  delivered: "Livraison effectuée",
  failed: "La livraison n'a pas pu être effectuée",
  cancelled: "Livraison annulée",
};

const STEP_INDEX: Record<string, number> = { pending: 0, offered: 0, accepted: 1, picked_up: 2, in_transit: 3, delivered: 4 };

function useSecondsSince(iso: string | null | undefined, serverTime: string) {
  // Décalage horloge client/serveur pris en compte pour un âge fiable.
  const skew = React.useMemo(() => Date.now() - new Date(serverTime).getTime(), [serverTime]);
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);
  if (!iso || now === null) return null;
  return Math.max(0, Math.round((now - skew - new Date(iso).getTime()) / 1000));
}

export function TrackingView({ token, initial }: { token: string; initial: TrackingPayload }) {
  const [data, setData] = React.useState(initial);
  const [refreshing, setRefreshing] = React.useState(false);
  const supabase = React.useMemo(() => getSupabaseBrowserClient(), []);

  const reload = React.useCallback(async () => {
    setRefreshing(true);
    const { data: next } = await supabase.rpc("get_tracking", { p_token: token });
    setRefreshing(false);
    if (next) setData(next as unknown as TrackingPayload);
  }, [supabase, token]);

  // Temps réel : le serveur signale un changement, la page relit l'état officiel.
  React.useEffect(() => {
    const channel = supabase.channel(`track:${token}`).on("broadcast", { event: "changed" }, () => void reload()).subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, token, reload]);

  // Filet de sécurité (réseau mobile instable) : relecture périodique.
  React.useEffect(() => {
    const ms = data.live ? 15000 : 60000;
    if (["delivered", "failed", "cancelled"].includes(data.status) && !data.can_confirm) return;
    const id = setInterval(() => document.visibilityState === "visible" && void reload(), ms);
    const onVisible = () => document.visibilityState === "visible" && void reload();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [data.live, data.status, data.can_confirm, reload]);

  const pickup = toLatLng(data.pickup.lat, data.pickup.lng);
  const dropoff = toLatLng(data.dropoff.lat, data.dropoff.lng);
  const pos = data.position;
  const age = useSecondsSince(pos?.at, data.server_time);
  const stale = pos ? pos.stale || (age !== null && age > data.stale_after_s) : false;
  const courierPoint = pos ? { lat: pos.lat, lng: pos.lng } : null;
  const route = useRoute(data.live && courierPoint && !stale ? courierPoint : null, data.status === "accepted" ? pickup : dropoff, courierPoint ? `${pos!.at}` : 0);
  const stepIndex = STEP_INDEX[data.status] ?? -1;
  const closed = ["delivered", "failed", "cancelled"].includes(data.status);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-line bg-surface p-5 shadow-xs">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-ink-3">
              {data.reference}
              {data.order_reference ? ` · commande ${data.order_reference}` : ""}
            </p>
            <h1 className="mt-1 text-lg font-semibold tracking-[-0.01em]">{HEADLINE[data.status]}</h1>
            {route.state === "ready" && data.live && !stale ? (
              <p className="mt-0.5 text-[13px] text-ink-2">
                Arrivée estimée vers {formatTime(new Date(Date.now() + route.durationSeconds * 1000))}
                <span className="text-ink-3"> · d&apos;après l&apos;itinéraire ({formatDuration(route.durationSeconds)})</span>
              </p>
            ) : null}
          </div>
          <Button size="icon" variant="ghost" onClick={() => void reload()} aria-label="Actualiser" loading={refreshing}>
            {!refreshing ? <RefreshCw /> : null}
          </Button>
        </div>

        {data.status !== "failed" && data.status !== "cancelled" ? (
          <ol className="mt-5 flex flex-col gap-0">
            {TRACKING_STEPS.map((step, i) => {
              const done = stepIndex >= i;
              const current = stepIndex === i && !closed;
              const at = data.timestamps[step.at];
              return (
                <li key={step.status} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < TRACKING_STEPS.length - 1 ? <span className={cn("absolute top-5 left-[9px] h-[calc(100%-12px)] w-0.5", stepIndex > i ? "bg-ink" : "bg-line")} aria-hidden /> : null}
                  <span
                    className={cn(
                      "relative z-[1] flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                      done ? "border-ink bg-ink text-white" : "border-line-strong bg-surface",
                      current && "ring-4 ring-accent/15",
                    )}
                  >
                    {done ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>
                  <div className="-mt-0.5 min-w-0">
                    <p className={cn("text-[14px]", done ? "font-medium text-ink" : "text-ink-3")}>{step.label}</p>
                    {at && done ? <p className="text-xs text-ink-3">{formatDateTime(at)}</p> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <Notice tone={data.status === "failed" ? "danger" : "neutral"} className="mt-4" icon={<CircleAlert />}>
            {data.status === "failed" ? "Le livreur a signalé un échec. La boutique ou le service vous recontactera." : "Cette livraison a été annulée."}
          </Notice>
        )}
      </section>

      {!closed ? (
        <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-xs">
          <div className="h-[300px] sm:h-[360px]">
            <MapView
              pickup={pickup}
              dropoff={dropoff}
              couriers={data.live && courierPoint ? [{ id: "courier", lat: courierPoint.lat, lng: courierPoint.lng, accuracy: pos!.accuracy, stale, label: data.courier?.first_name ?? "Livreur", highlight: true, status: "busy" }] : []}
              route={route.state === "ready" ? route.coordinates : null}
              fitKey={`${data.status}-${courierPoint ? "c" : "n"}`}
              scrollWheelZoom={false}
            />
          </div>
          <div className="flex items-center gap-2 border-t border-line px-4 py-2.5 text-xs">
            {!data.live ? (
              <span className="flex items-center gap-1.5 text-ink-3">
                <Clock className="size-3.5" /> Le suivi en direct démarre quand le livreur accepte la course.
              </span>
            ) : !pos ? (
              <span className="flex items-center gap-1.5 text-warning-ink">
                <MapPinOff className="size-3.5" /> Position indisponible : le téléphone du livreur n&apos;a pas encore transmis sa position.
              </span>
            ) : stale ? (
              <span className="flex items-center gap-1.5 text-warning-ink">
                <MapPinOff className="size-3.5" /> Position obsolète — dernière mise à jour à {formatTime(pos.at)}
                {age !== null ? ` (il y a ${formatDuration(age)})` : ""}.
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-success">
                <span className="size-2 animate-pulse-dot rounded-full bg-success" /> Position en direct · mise à jour {age !== null && age < 60 ? `il y a ${age} s` : `à ${formatTime(pos.at)}`}
              </span>
            )}
          </div>
        </section>
      ) : null}

      <section className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
        <div className="bg-surface p-4">
          <p className="text-xs font-medium text-ink-3">Point de collecte</p>
          <p className="mt-0.5 text-[14px] font-medium">{data.pickup.label}</p>
          <p className="text-[13px] text-ink-2">{data.pickup.address}</p>
        </div>
        <div className="bg-surface p-4">
          <p className="text-xs font-medium text-ink-3">Destination</p>
          <p className="mt-0.5 text-[14px] font-medium">{data.dropoff.label}</p>
          <p className="text-[13px] text-ink-2">{data.dropoff.address}</p>
        </div>
      </section>

      {data.courier || data.collect_amount > 0 || data.price ? (
        <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
          {data.courier ? (
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-ink-3">Votre livreur</p>
                <p className="text-[14px] font-medium">
                  {data.courier.first_name}
                  {data.courier.vehicle_type ? <span className="font-normal text-ink-3"> · {VEHICLES[data.courier.vehicle_type] ?? data.courier.vehicle_type}</span> : null}
                </p>
              </div>
              {data.courier.phone ? (
                <Button asChild variant="secondary">
                  <a href={telHref(data.courier.phone) ?? "#"}>
                    <Phone /> Appeler
                  </a>
                </Button>
              ) : null}
            </div>
          ) : null}
          {data.collect_amount > 0 && data.status !== "delivered" ? (
            <p className="rounded-md bg-warning-soft px-3 py-2 text-[13.5px] text-warning-ink">
              À régler à la livraison : <span className="font-semibold tabular">{formatMoney(data.collect_amount, data.currency)}</span> ({PAYMENT_METHOD[data.payment_method]})
            </p>
          ) : null}
          {data.price ? (
            <p className="text-[13px] text-ink-3">
              Prix de la course : <span className="font-medium text-ink tabular">{formatMoney(data.price, data.currency)}</span>
            </p>
          ) : null}
        </section>
      ) : null}

      <TrackingActions token={token} data={data} onChange={reload} />
    </div>
  );
}

function TrackingActions({ token, data, onChange }: { token: string; data: TrackingPayload; onChange: () => Promise<void> }) {
  const [pending, setPending] = React.useState<string | null>(null);
  const [claimOpen, setClaimOpen] = React.useState(false);
  const [claim, setClaim] = React.useState({ category: "late", description: "", name: "", phone: "" });
  const [claimRef, setClaimRef] = React.useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      {data.can_confirm ? (
        <Button
          size="lg"
          variant="success"
          loading={pending === "confirm"}
          onClick={async () => {
            setPending("confirm");
            const res = await confirmReceiptAction(token);
            setPending(null);
            if (!res.ok) return toast.error(res.error);
            toast.success(res.message ?? "Merci !");
            await onChange();
          }}
        >
          <Check /> Je confirme avoir reçu mon colis
        </Button>
      ) : null}
      {data.timestamps.recipient_confirmed_at ? <Notice tone="success">Réception confirmée le {formatDateTime(data.timestamps.recipient_confirmed_at)}.</Notice> : null}
      {data.can_cancel ? (
        <Button
          variant="danger-ghost"
          loading={pending === "cancel"}
          onClick={async () => {
            if (!window.confirm("Annuler cette demande de livraison ?")) return;
            setPending("cancel");
            const res = await cancelOnDemandAction(token);
            setPending(null);
            if (!res.ok) return toast.error(res.error);
            toast.success(res.message ?? "");
            await onChange();
          }}
        >
          Annuler la demande
        </Button>
      ) : null}
      <Button variant="ghost" onClick={() => setClaimOpen(true)}>
        Signaler un problème
      </Button>
      <Dialog open={claimOpen} onOpenChange={setClaimOpen}>
        <DialogContent
          title="Signaler un problème"
          description="Votre message est transmis à la boutique et au service client."
          footer={
            claimRef ? (
              <Button variant="primary" onClick={() => setClaimOpen(false)}>
                Fermer
              </Button>
            ) : (
              <Button
                variant="primary"
                loading={pending === "claim"}
                onClick={async () => {
                  setPending("claim");
                  const res = await submitClaimAction(token, claim);
                  setPending(null);
                  if (!res.ok) return toast.error(res.error);
                  setClaimRef(res.data.reference);
                }}
              >
                Envoyer
              </Button>
            )
          }
        >
          {claimRef ? (
            <Notice tone="success" title={`Réclamation ${claimRef} enregistrée`}>
              Conservez cette référence. Vous serez recontacté par téléphone.
            </Notice>
          ) : (
            <div className="flex flex-col gap-4">
              <Field label="Motif" htmlFor="cl-cat">
                <NativeSelect id="cl-cat" value={claim.category} onChange={(e) => setClaim({ ...claim, category: e.target.value })}>
                  {Object.entries(CLAIM_CATEGORY).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Description" htmlFor="cl-desc">
                <Textarea id="cl-desc" rows={3} value={claim.description} onChange={(e) => setClaim({ ...claim, description: e.target.value })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Votre nom" htmlFor="cl-name">
                  <Input id="cl-name" value={claim.name} onChange={(e) => setClaim({ ...claim, name: e.target.value })} />
                </Field>
                <Field label="Téléphone" htmlFor="cl-phone">
                  <Input id="cl-phone" type="tel" value={claim.phone} onChange={(e) => setClaim({ ...claim, phone: e.target.value })} />
                </Field>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
