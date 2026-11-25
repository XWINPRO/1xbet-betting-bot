"use client";

import * as React from "react";
import { MapView } from "@/components/map";
import { useRoute } from "@/components/map/use-route";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { secondsSince } from "@/lib/format";
import type { LatLng } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

export type LivePosition = { lat: number; lng: number; accuracy: number | null; at: string } | null;

/**
 * Carte d'une course : point de collecte, destination et position réelle
 * du livreur. Le temps réel signale un changement ; la position est relue
 * par job_courier_position(), qui vérifie le plan de la boutique.
 */
export function LiveCourierMap({
  jobId,
  courierId,
  courierName,
  initialPosition,
  pickup,
  dropoff,
  live,
  staleAfterSeconds,
  height = 280,
  className,
}: {
  jobId: string;
  courierId: string | null;
  courierName?: string | null;
  initialPosition: LivePosition;
  pickup: LatLng | null;
  dropoff: LatLng | null;
  live: boolean;
  staleAfterSeconds: number;
  height?: number;
  className?: string;
}) {
  const { t, f, locale } = useI18n();
  const [position, setPosition] = React.useState<LivePosition>(initialPosition);
  const [, tick] = React.useState(0);

  React.useEffect(() => setPosition(initialPosition), [initialPosition]);

  React.useEffect(() => {
    if (!courierId || !live) return;
    const supabase = getSupabaseBrowserClient();
    let busy = false;
    const reload = async () => {
      if (busy) return;
      busy = true;
      const { data } = await supabase.rpc("job_courier_position", { p_job_id: jobId });
      busy = false;
      const next = (data as { position: LivePosition } | null)?.position ?? null;
      if (next) setPosition({ lat: next.lat, lng: next.lng, accuracy: next.accuracy, at: next.at });
    };
    const channel = supabase
      .channel(`courier-pos-${courierId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "couriers", filter: `id=eq.${courierId}` }, () => void reload())
      .subscribe();
    // Filet de sécurité si le temps réel est interrompu.
    const poll = setInterval(() => document.visibilityState === "visible" && void reload(), 20000);
    const id = setInterval(() => tick((n) => n + 1), 15000);
    return () => {
      clearInterval(id);
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [jobId, courierId, live]);

  const age = position ? secondsSince(position.at) : null;
  const stale = age !== null && age > staleAfterSeconds;
  const target = position ? dropoff : null;
  const route = useRoute(live && position ? { lat: position.lat, lng: position.lng } : pickup, dropoff, position ? Math.round(position.lat * 1000) + Math.round(position.lng * 1000) : 0);
  const km = (meters: number) => (meters / 1000).toLocaleString(locale === "en" ? "en-GB" : "fr-FR", { maximumFractionDigits: 1 });

  return (
    <div className={cn("overflow-hidden rounded-md border border-line", className)}>
      <div style={{ height }}>
        <MapView
          pickup={pickup}
          dropoff={dropoff}
          couriers={
            live && position
              ? [{ id: courierId ?? "c", lat: position.lat, lng: position.lng, accuracy: position.accuracy, stale, label: courierName ?? t("Livreur"), highlight: true, status: "busy" }]
              : []
          }
          route={route.state === "ready" ? route.coordinates : null}
          fitKey={`${pickup?.lat}-${dropoff?.lat}-${position ? "p" : "n"}`}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-subtle px-3 py-2 text-xs text-ink-3">
        <span>
          {!live
            ? t("Suivi en direct inactif pour cette course.")
            : !position
              ? t("Position du livreur pas encore reçue.")
              : stale
                ? t("Position obsolète — dernière mise à jour il y a {duration}.", { duration: f.duration(age) })
                : `${t("Position reçue il y a {duration}", { duration: age !== null && age < 60 ? `${age} s` : f.duration(age) })}${
                    position.accuracy ? ` · ${t("précision ± {m} m", { m: Math.round(position.accuracy) })}` : ""
                  }.`}
        </span>
        <span>
          {route.state === "ready" && target
            ? t("Itinéraire : {km} km · ~{duration}", { km: km(route.distanceMeters), duration: f.duration(route.durationSeconds) })
            : route.state === "disabled"
              ? t("Itinéraire non configuré")
              : null}
        </span>
      </div>
    </div>
  );
}
