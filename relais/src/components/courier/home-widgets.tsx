"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, MapPin, Navigation, Package, Power } from "lucide-react";
import { claimJobAction, respondOfferAction, setAvailabilityAction } from "@/lib/actions/courier";
import { useCourierLocation } from "@/components/courier/location-provider";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { JOB_STATUS, PACKAGE_TYPES } from "@/lib/status";
import { formatDistanceKm, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { JobStatus } from "@/types/domain";

export function AvailabilityToggle({ available, activeJobs }: { available: boolean; activeJobs: number }) {
  const router = useRouter();
  const { start, geo } = useCourierLocation();
  const [pending, setPending] = React.useState(false);
  async function toggle() {
    setPending(true);
    // Geste explicite : c'est ici que la permission de localisation est demandée.
    if (!available && geo !== "tracking" && geo !== "denied") start();
    const res = await setAvailabilityAction(!available);
    setPending(false);
    if (!res.ok) return toast.error(res.error);
    router.refresh();
  }
  return (
    <div className={cn("rounded-lg border p-4", available ? "border-success/30 bg-success-soft/60" : "border-line bg-surface")}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-ink">{available ? "Vous êtes disponible" : "Vous êtes indisponible"}</p>
          <p className="mt-0.5 text-[13px] text-ink-3">
            {available
              ? "Vous pouvez recevoir des courses. Votre position est partagée avec vos boutiques."
              : activeJobs > 0
                ? "Vous terminez vos courses en cours, sans en recevoir de nouvelles."
                : "Aucune course ne vous sera proposée et votre position n'est pas partagée."}
          </p>
        </div>
      </div>
      <Button size="xl" block variant={available ? "secondary" : "success"} className="mt-4" loading={pending} onClick={toggle}>
        <Power /> {available ? "Passer indisponible" : "Passer disponible"}
      </Button>
    </div>
  );
}

type OfferJob = {
  id: string;
  reference: string;
  status: JobStatus;
  pickup_name: string | null;
  pickup_address: string;
  dropoff_address: string;
  collect_amount: number;
  price: number;
  currency: string;
  storeName: string | null;
  source: "store_order" | "on_demand";
};

export function OfferCard({ job }: { job: OfferJob }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<"accept" | "decline" | null>(null);
  const [declineOpen, setDeclineOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  async function respond(accept: boolean) {
    setPending(accept ? "accept" : "decline");
    const res = await respondOfferAction(job.id, accept, reason);
    setPending(null);
    if (!res.ok) return toast.error(res.error);
    toast.success(res.message ?? "");
    setDeclineOpen(false);
    if (accept) router.push(`/courier/jobs/${job.id}`);
    else router.refresh();
  }
  return (
    <article className="rounded-lg border-2 border-accent bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide text-accent uppercase">Nouvelle course</p>
        <span className="font-mono text-xs text-ink-3">{job.reference}</span>
      </div>
      <p className="mt-1 text-[13px] text-ink-3">{job.storeName ?? "Livraison ponctuelle"}</p>
      <Route pickup={job.pickup_address} pickupLabel={job.pickup_name} dropoff={job.dropoff_address} />
      {job.collect_amount > 0 ? (
        <p className="mt-3 rounded-md bg-warning-soft px-3 py-2 text-[13px] text-warning-ink">
          À encaisser : <span className="font-semibold tabular">{formatMoney(job.collect_amount, job.currency)}</span>
        </p>
      ) : null}
      <div className="mt-4 grid grid-cols-[1fr_2fr] gap-2">
        <Button size="lg" variant="secondary" onClick={() => setDeclineOpen(true)} disabled={pending !== null}>
          Refuser
        </Button>
        <Button size="lg" variant="primary" loading={pending === "accept"} onClick={() => respond(true)}>
          Accepter
        </Button>
      </div>
      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent
          size="sm"
          title="Refuser la course"
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeclineOpen(false)}>
                Retour
              </Button>
              <Button variant="danger" loading={pending === "decline"} onClick={() => respond(false)}>
                Refuser
              </Button>
            </>
          }
        >
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motif (facultatif) : trop loin, panne, déjà occupé…" rows={3} />
        </DialogContent>
      </Dialog>
    </article>
  );
}

export function Route({ pickup, pickupLabel, dropoff, dropoffLabel }: { pickup: string; pickupLabel?: string | null; dropoff: string; dropoffLabel?: string | null }) {
  return (
    <ol className="mt-3 space-y-2.5">
      <li className="flex gap-3">
        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[5px] bg-ink text-[10px] font-semibold text-white">A</span>
        <span className="min-w-0 text-[13.5px]">
          {pickupLabel ? <span className="block font-medium text-ink">{pickupLabel}</span> : null}
          <span className="text-ink-2">{pickup}</span>
        </span>
      </li>
      <li className="flex gap-3">
        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[5px] bg-accent text-[10px] font-semibold text-white">B</span>
        <span className="min-w-0 text-[13.5px]">
          {dropoffLabel ? <span className="block font-medium text-ink">{dropoffLabel}</span> : null}
          <span className="text-ink-2">{dropoff}</span>
        </span>
      </li>
    </ol>
  );
}

export function ActiveJobCard({ job }: { job: OfferJob & { dropoff_name: string } }) {
  return (
    <Link href={`/courier/jobs/${job.id}`} className="block rounded-lg border border-line bg-surface p-4 shadow-xs active:bg-subtle">
      <div className="flex items-center justify-between gap-2">
        <StatusBadge map={JOB_STATUS} value={job.status} pulse={job.status === "in_transit"} />
        <span className="font-mono text-xs text-ink-3">{job.reference}</span>
      </div>
      <Route pickup={job.pickup_address} pickupLabel={job.pickup_name} dropoff={job.dropoff_address} dropoffLabel={job.dropoff_name} />
      <div className="mt-4 flex items-center justify-between rounded-md bg-ink px-4 py-3 text-white">
        <span className="flex items-center gap-2 text-[14px] font-medium">
          <Navigation className="size-4" /> Ouvrir la course
        </span>
        <ArrowRight className="size-4" />
      </div>
    </Link>
  );
}

export type OpenJob = {
  id: string;
  reference: string;
  pickup_address: string;
  dropoff_address: string;
  package_type: string | null;
  distance_km: number | null;
  price: number;
  currency: string;
  distance_to_pickup_km: number | null;
};

export function OpenJobCard({ job }: { job: OpenJob }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  return (
    <article className="rounded-lg border border-line bg-surface p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[15px] font-semibold tabular">{formatMoney(job.price, job.currency)}</span>
        <span className="font-mono text-xs text-ink-3">{job.reference}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-ink-3">
        {job.distance_to_pickup_km !== null ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" /> collecte à {formatDistanceKm(job.distance_to_pickup_km)}
          </span>
        ) : null}
        {job.distance_km !== null ? <span>trajet ≈ {formatDistanceKm(job.distance_km)} (à vol d&apos;oiseau)</span> : null}
        {job.package_type ? (
          <span className="inline-flex items-center gap-1">
            <Package className="size-3" /> {PACKAGE_TYPES[job.package_type] ?? job.package_type}
          </span>
        ) : null}
      </div>
      <Route pickup={job.pickup_address} dropoff={job.dropoff_address} />
      <Button
        size="lg"
        block
        variant="primary"
        className="mt-4"
        loading={pending}
        onClick={async () => {
          setPending(true);
          const res = await claimJobAction(job.id);
          setPending(false);
          if (!res.ok) {
            toast.error(res.error);
            router.refresh();
            return;
          }
          toast.success("Course acceptée.");
          router.push(`/courier/jobs/${job.id}`);
        }}
      >
        Prendre cette course
      </Button>
    </article>
  );
}
