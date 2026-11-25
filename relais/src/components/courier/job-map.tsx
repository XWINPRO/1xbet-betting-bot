"use client";

import { MapView } from "@/components/map";
import { useCourierLocation } from "@/components/courier/location-provider";
import { useRoute } from "@/components/map/use-route";
import { useI18n } from "@/i18n/client";
import type { LatLng } from "@/lib/geo";

/** Carte de mission : collecte (A), destination (B), position réelle du livreur. */
export function CourierJobMap({ pickup, dropoff, target }: { pickup: LatLng | null; dropoff: LatLng | null; target: "pickup" | "dropoff" | null }) {
  const { t, f, locale } = useI18n();
  const { lastFix } = useCourierLocation();
  const me = lastFix ? { lat: lastFix.lat, lng: lastFix.lng } : null;
  const to = target === "pickup" ? pickup : target === "dropoff" ? dropoff : null;
  const route = useRoute(me ?? (target === "dropoff" ? pickup : null), to, me ? `${Math.round(me.lat * 500)}:${Math.round(me.lng * 500)}` : 0);
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="h-[240px]">
        <MapView
          pickup={pickup}
          dropoff={dropoff}
          couriers={me ? [{ id: "me", lat: me.lat, lng: me.lng, accuracy: lastFix?.accuracy, label: t("Vous"), status: "busy" }] : []}
          route={route.state === "ready" ? route.coordinates : null}
          fitKey={`${target}-${me ? "me" : "no"}`}
        />
      </div>
      {route.state === "ready" ? (
        <p className="border-t border-line px-3 py-2 text-xs text-ink-3">
          {t("Itinéraire estimé :")} {(route.distanceMeters / 1000).toLocaleString(locale === "en" ? "en-GB" : "fr-FR", { maximumFractionDigits: 1 })} km · ~{f.duration(route.durationSeconds)}
        </p>
      ) : !me ? (
        <p className="border-t border-line px-3 py-2 text-xs text-ink-3">{t("Votre position apparaîtra dès que le GPS l'aura obtenue.")}</p>
      ) : null}
    </div>
  );
}
