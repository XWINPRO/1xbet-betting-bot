import { haversineKm, toLatLng, type LatLng } from "@/lib/geo";
import { secondsSince } from "@/lib/format";
import type { BoardCourier, EffectiveCourierStatus } from "@/types/domain";

/**
 * Suggestion de livreur — algorithme à base de règles (pas d'IA).
 *
 * Critères, dans l'ordre d'importance :
 *   1. Disponibilité réelle (calculée en base)
 *   2. Distance à vol d'oiseau jusqu'au point de collecte
 *   3. Nombre de courses en cours
 *   4. Zone de travail déclarée
 *   5. Fraîcheur de la dernière position GPS
 *
 * La suggestion est indicative : le commerçant choisit toujours le livreur.
 */
export type CourierSuggestion = {
  courier: BoardCourier;
  status: EffectiveCourierStatus;
  score: number;
  distanceKm: number | null;
  gpsAgeSeconds: number | null;
  reasons: string[];
  assignable: boolean;
};

const STATUS_BASE: Record<EffectiveCourierStatus, number> = {
  available: 100,
  busy: 35,
  unavailable: 5,
  offline: 0,
  inactive: -1000,
};

export function rankCouriers(
  couriers: BoardCourier[],
  pickup: LatLng | null,
  options: { staleAfterSeconds: number; now?: Date },
): CourierSuggestion[] {
  const now = options.now ?? new Date();

  const ranked = couriers.map((courier) => {
    const status = (courier.effective_status as EffectiveCourierStatus) ?? "offline";
    const reasons: string[] = [];
    let score = STATUS_BASE[status] ?? 0;

    const position = toLatLng(courier.last_lat, courier.last_lng);
    const gpsAgeSeconds = secondsSince(courier.last_location_at, now);
    let distanceKm: number | null = null;

    if (pickup && position) {
      distanceKm = haversineKm(position, pickup);
      score -= Math.min(distanceKm * 4, 45);
    } else if (!position) {
      score -= 12;
      reasons.push("Position inconnue");
    }

    if (gpsAgeSeconds !== null && gpsAgeSeconds > options.staleAfterSeconds) {
      score -= 10;
      reasons.push("Position obsolète");
    }

    const active = courier.active_jobs ?? 0;
    if (active > 0) {
      score -= active * 15;
      reasons.push(`${active} course${active > 1 ? "s" : ""} en cours`);
    }

    const zoneCenter = toLatLng(courier.zone_lat, courier.zone_lng);
    if (pickup && zoneCenter && courier.zone_radius_km) {
      const inZone = haversineKm(zoneCenter, pickup) <= Number(courier.zone_radius_km);
      score += inZone ? 10 : -5;
      reasons.push(inZone ? "Collecte dans sa zone" : "Collecte hors de sa zone");
    }

    return {
      courier,
      status,
      score: Math.round(score),
      distanceKm,
      gpsAgeSeconds,
      reasons,
      assignable: status !== "inactive" && courier.membership_status === "active" && courier.linked,
    };
  });

  return ranked.sort((a, b) => {
    if (a.assignable !== b.assignable) return a.assignable ? -1 : 1;
    return b.score - a.score;
  });
}

/** Meilleure suggestion : uniquement un livreur réellement disponible. */
export function pickRecommended(suggestions: CourierSuggestion[]): CourierSuggestion | null {
  return suggestions.find((s) => s.assignable && s.status === "available") ?? null;
}
