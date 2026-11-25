"use client";

import * as React from "react";
import { Bike, Info, MapPin, Signal } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/page";
import { rankCouriers, pickRecommended } from "@/lib/dispatch";
import { COURIER_STATUS, VEHICLES } from "@/lib/status";
import { useI18n } from "@/i18n/client";
import type { I18n } from "@/i18n/translate";
import type { LatLng } from "@/lib/geo";
import type { BoardCourier, EffectiveCourierStatus } from "@/types/domain";
import { cn } from "@/lib/utils";

function gpsLabel(seconds: number | null, t: I18n["t"]) {
  if (seconds === null) return t("Aucune position");
  if (seconds < 60) return t("GPS à l'instant");
  if (seconds < 3600) return t("GPS il y a {n} min", { n: Math.round(seconds / 60) });
  return t("GPS il y a {n} h", { n: Math.round(seconds / 3600) });
}

/**
 * Liste classée des livreurs. La suggestion n'est qu'une aide : le
 * commerçant choisit librement.
 */
export function CourierPicker({
  couriers,
  pickup,
  staleAfterSeconds,
  currentCourierId,
  onPick,
  pendingId,
  liveTracking = true,
}: {
  couriers: BoardCourier[];
  pickup: LatLng | null;
  staleAfterSeconds: number;
  currentCourierId?: string | null;
  onPick: (courierId: string) => void;
  pendingId?: string | null;
  /** false : le plan n'inclut pas la position GPS (pas de distance ni d'âge GPS). */
  liveTracking?: boolean;
}) {
  const { t, tn, f } = useI18n();
  const [now] = React.useState(() => new Date());
  const ranked = React.useMemo(
    () => rankCouriers(couriers, pickup, { staleAfterSeconds, now, positions: liveTracking }),
    [couriers, pickup, staleAfterSeconds, now, liveTracking],
  );
  const recommended = pickRecommended(ranked);

  if (couriers.length === 0) {
    return (
      <EmptyState
        compact
        icon={<Bike />}
        title={t("Aucun livreur dans votre équipe")}
        description={t("Ajoutez vos livreurs depuis la page Livreurs : ils recevront un lien d'activation.")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-start gap-2 text-xs text-ink-3">
        <Info className="mt-px size-3.5 shrink-0" />
        {liveTracking
          ? t("Classement par règles : disponibilité, distance à vol d'oiseau jusqu'au point de collecte, courses en cours, zone de travail et fraîcheur du GPS.")
          : t("Classement par règles : disponibilité, courses en cours et zone de travail. La distance GPS est disponible avec les plans Pro et Entreprise.")}
        {liveTracking && !pickup ? ` ${t("Position de la boutique non renseignée : la distance n'est pas calculée.")}` : ""}
      </p>
      <ul className="divide-y divide-line overflow-hidden rounded-md border border-line">
        {ranked.map((s) => {
          const isCurrent = s.courier.courier_id === currentCourierId;
          const isRecommended = recommended?.courier.courier_id === s.courier.courier_id;
          return (
            <li key={s.courier.courier_id} className={cn("flex flex-wrap items-center gap-3 px-3 py-2.5", !s.assignable && "opacity-60", isRecommended && "bg-accent-soft/40")}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13.5px] font-medium text-ink">{s.courier.full_name}</span>
                  <StatusBadge map={COURIER_STATUS} value={s.status as EffectiveCourierStatus} />
                  {isRecommended ? <Badge tone="accent" dot={false}>{t("Suggéré")}</Badge> : null}
                  {isCurrent ? <Badge tone="neutral" dot={false}>{t("Actuel")}</Badge> : null}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-3">
                  {s.courier.vehicle_type ? <span>{VEHICLES[s.courier.vehicle_type] ? t(VEHICLES[s.courier.vehicle_type]) : s.courier.vehicle_type}</span> : null}
                  {liveTracking ? (
                    <>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" />
                        {s.distanceKm !== null ? t("{distance} de la collecte", { distance: f.distance(s.distanceKm) }) : t("distance inconnue")}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Signal className="size-3" />
                        {gpsLabel(s.gpsAgeSeconds, t)}
                      </span>
                    </>
                  ) : null}
                  <span>{tn(s.courier.active_jobs, "{n} course en cours", "{n} courses en cours")}</span>
                  {!s.courier.linked ? <span className="text-warning-ink">{t("compte non activé")}</span> : null}
                  {s.courier.membership_status !== "active" ? <span className="text-danger-ink">{t("accès suspendu")}</span> : null}
                </div>
                {s.reasons.length ? <p className="mt-0.5 text-[11.5px] text-ink-4">{s.reasons.map((r) => t(r)).join(" · ")}</p> : null}
              </div>
              <Button
                type="button"
                size="sm"
                variant={isRecommended ? "primary" : "secondary"}
                disabled={!s.assignable || isCurrent}
                loading={pendingId === s.courier.courier_id}
                onClick={() => onPick(s.courier.courier_id)}
              >
                {isCurrent ? t("Attribué") : t("Attribuer")}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
