import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChevronLeft, Navigation, Phone } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCourier } from "@/lib/auth";
import { formatDateTime, formatMoney } from "@/lib/format";
import { formatPhone, telHref } from "@/lib/phone";
import { googleMapsDirectionsUrl, googleMapsSearchUrl, toLatLng, wazeUrl } from "@/lib/geo";
import { JOB_STATUS, PACKAGE_TYPES, PAYMENT_METHOD } from "@/lib/status";
import { whatsappUrl, waMessages } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/page";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { CourierJobMap } from "@/components/courier/job-map";
import { JobActions } from "@/components/courier/job-actions";
import { cn } from "@/lib/utils";
import type { JobStatus } from "@/types/domain";

export const metadata = { title: "Course" };

const STEPS: { status: JobStatus; label: string }[] = [
  { status: "accepted", label: "Acceptée" },
  { status: "picked_up", label: "Récupérée" },
  { status: "in_transit", label: "En route" },
  { status: "delivered", label: "Livrée" },
];

function Stop({
  letter,
  title,
  name,
  address,
  phone,
  point,
  active,
  whatsappText,
}: {
  letter: "A" | "B";
  title: string;
  name: string | null;
  address: string;
  phone: string | null;
  point: { lat: number; lng: number } | null;
  active: boolean;
  whatsappText?: string;
}) {
  const nav = point ? googleMapsDirectionsUrl(point) : googleMapsSearchUrl(address);
  return (
    <section className={cn("rounded-lg border bg-surface p-4", active ? "border-ink shadow-sm" : "border-line")}>
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-[6px] text-[11px] font-semibold text-white", letter === "A" ? "bg-ink" : "bg-accent")}>{letter}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-ink-3">{title}</p>
          {name ? <p className="text-[15px] font-semibold text-ink">{name}</p> : null}
          <p className="text-[14px] text-ink-2">{address}</p>
          {!point ? <p className="mt-0.5 text-xs text-warning-ink">Pas de position GPS : navigation par adresse.</p> : null}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button asChild size="lg" variant={active ? "primary" : "secondary"}>
          <a href={nav} target="_blank" rel="noopener noreferrer">
            <Navigation /> Itinéraire
          </a>
        </Button>
        {point ? (
          <Button asChild size="lg" variant="secondary">
            <a href={wazeUrl(point)} target="_blank" rel="noopener noreferrer">
              Waze
            </a>
          </Button>
        ) : (
          <span />
        )}
        {phone ? (
          <>
            <Button asChild size="lg" variant="secondary">
              <a href={telHref(phone) ?? "#"}>
                <Phone /> Appeler
              </a>
            </Button>
            <WhatsAppButton size="lg" label="WhatsApp" href={whatsappUrl(phone, whatsappText)} />
          </>
        ) : null}
      </div>
      {phone ? <p className="mt-2 text-xs text-ink-3 tabular">{formatPhone(phone)}</p> : null}
    </section>
  );
}

export default async function CourierJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { courier } = await requireCourier();
  const supabase = await createSupabaseServerClient();
  const { data: job } = await supabase
    .from("delivery_jobs")
    .select("*, stores(name), orders!delivery_jobs_order_id_fkey(reference, order_items(name, quantity, variant_name))")
    .eq("id", id)
    .eq("courier_id", courier.id)
    .maybeSingle();
  if (!job) notFound();

  const pickup = toLatLng(job.pickup_lat, job.pickup_lng);
  const dropoff = toLatLng(job.dropoff_lat, job.dropoff_lng);
  const live = ["accepted", "picked_up", "in_transit"].includes(job.status);
  const target = job.status === "accepted" || job.status === "offered" ? "pickup" : live ? "dropoff" : null;
  const stepIndex = STEPS.findIndex((s) => s.status === job.status);
  const items = job.orders?.order_items ?? [];
  const collect = Number(job.collect_amount);
  const revealContacts = job.status !== "offered";

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-center justify-between">
        <Link href="/courier" className="inline-flex items-center gap-1 text-[13px] text-ink-3">
          <ChevronLeft className="size-4" /> Accueil
        </Link>
        <span className="font-mono text-xs text-ink-3">{job.reference}</span>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold">{job.stores?.name ?? "Livraison ponctuelle"}</h1>
          <StatusBadge map={JOB_STATUS} value={job.status} pulse={job.status === "in_transit"} />
        </div>
        {job.orders?.reference ? <p className="text-[13px] text-ink-3">Commande {job.orders.reference}</p> : null}
      </div>

      {live || job.status === "delivered" ? (
        <ol className="grid grid-cols-4 gap-1" aria-label="Progression">
          {STEPS.map((s, i) => {
            const done = stepIndex >= i;
            return (
              <li key={s.status} className="flex flex-col gap-1.5">
                <span className={cn("h-1.5 rounded-full", done ? "bg-ink" : "bg-line")} />
                <span className={cn("flex items-center gap-1 text-[11px]", done ? "font-medium text-ink" : "text-ink-4")}>
                  {done ? <Check className="size-3" /> : null}
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}

      {collect > 0 && job.status !== "delivered" ? (
        <div className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3">
          <p className="text-xs font-medium text-warning-ink">Montant à encaisser à la livraison</p>
          <p className="text-2xl font-semibold tabular text-warning-ink">{formatMoney(collect, job.currency)}</p>
          <p className="text-xs text-warning-ink/80">{PAYMENT_METHOD[job.payment_method]}</p>
        </div>
      ) : null}

      {job.status === "cancelled" ? <Notice tone="neutral" title="Course annulée">{job.cancel_reason}</Notice> : null}
      {job.status === "failed" ? <Notice tone="danger" title="Échec enregistré">{job.failure_reason}</Notice> : null}
      {job.status === "delivered" ? (
        <Notice tone="success" title={`Livrée le ${formatDateTime(job.delivered_at)}`}>
          {job.cash_collected ? `Espèces déclarées encaissées : ${formatMoney(collect, job.currency)}.` : null}
        </Notice>
      ) : null}

      {live || job.status === "offered" ? <CourierJobMap pickup={pickup} dropoff={dropoff} target={target} /> : null}

      <Stop
        letter="A"
        title="Point de collecte"
        name={job.pickup_name}
        address={job.pickup_address}
        phone={revealContacts && live ? job.pickup_phone : null}
        point={pickup}
        active={target === "pickup"}
      />
      <Stop
        letter="B"
        title="Destination"
        name={revealContacts ? job.dropoff_name : null}
        address={job.dropoff_address}
        phone={revealContacts && live ? job.dropoff_phone : null}
        point={dropoff}
        active={target === "dropoff"}
        whatsappText={waMessages.courierToRecipient({ recipientName: job.dropoff_name.split(" ")[0], storeName: job.stores?.name, reference: job.reference })}
      />

      {items.length || job.package_description || job.package_type || job.instructions ? (
        <section className="rounded-lg border border-line bg-surface p-4 text-[14px]">
          <p className="text-xs font-medium text-ink-3">Colis</p>
          {job.package_type ? <p className="font-medium">{PACKAGE_TYPES[job.package_type] ?? job.package_type}</p> : null}
          {items.length ? (
            <ul className="mt-1 space-y-0.5 text-ink-2">
              {items.map((i, idx) => (
                <li key={idx}>
                  {i.quantity} × {i.name}
                  {i.variant_name ? ` (${i.variant_name})` : ""}
                </li>
              ))}
            </ul>
          ) : job.package_description ? (
            <p className="text-ink-2">{job.package_description}</p>
          ) : null}
          {job.instructions ? (
            <div className="mt-3 rounded-md bg-subtle px-3 py-2">
              <p className="text-xs font-medium text-ink-3">Instructions</p>
              <p className="text-ink">{job.instructions}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {live || job.status === "offered" ? (
        <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-10 -mx-4 border-t border-line bg-canvas/95 px-4 pt-3 pb-1 backdrop-blur-sm">
          <JobActions jobId={job.id} status={job.status} collectAmount={collect} currency={job.currency} recipientName={job.dropoff_name} />
        </div>
      ) : null}
    </div>
  );
}
