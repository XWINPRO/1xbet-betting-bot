"use client";

import * as React from "react";
import { MapView } from "@/components/map";
import { useRoute } from "@/components/map/use-route";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatDuration, secondsSince } from "@/lib/format";
import type { LatLng } from "@/lib/geo";
import { cn } from "@/lib/utils";

export type LivePosition = { lat: number; lng: number; accuracy: number | null; at: string } | null;

/**
 * Carte d'une course : point de collecte, destination et position réelle
 * du livreur (mise à jour en temps réel via Supabase Realtime).
 */
export function LiveCourierMap({
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
  const [position, setPosition] = React.useState<LivePosition>(initialPosition);
  const [, tick] = React.useState(0);

  React.useEffect(() => setPosition(initialPosition), [initialPosition]);

  React.useEffect(() => {
    if (!courierId || !live) return;
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`courier-pos-${courierId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "couriers", filter: `id=eq.${courierId}` }, (payload) => {
        const row = payload.new as { last_lat: number | null; last_lng: number | null; last_accuracy: number | null; last_location_at: string | null };
        if (row.last_lat !== null && row.last_lng !== null && row.last_location_at) {
          setPosition({ lat: row.last_lat, lng: row.last_lng, accuracy: row.last_accuracy, at: row.last_location_at });
        }
      })
      .subscribe();
    const id = setInterval(() => tick((n) => n + 1), 15000);
    return () => {
      clearInterval(id);
      void supabase.removeChannel(channel);
    };
  }, [courierId, live]);

  const age = position ? secondsSince(position.at) : null;
  const stale = age !== null && age > staleAfterSeconds;
  const target = position ? dropoff : null;
  const route = useRoute(live && position ? { lat: position.lat, lng: position.lng } : pickup, dropoff, position ? Math.round(position.lat * 1000) + Math.round(position.lng * 1000) : 0);

  return (
    <div className={cn("overflow-hidden rounded-md border border-line", className)}>
      <div style={{ height }}>
        <MapView
          pickup={pickup}
          dropoff={dropoff}
          couriers={
            live && position
              ? [{ id: courierId ?? "c", lat: position.lat, lng: position.lng, accuracy: position.accuracy, stale, label: courierName ?? "Livreur", highlight: true, status: "busy" }]
              : []
          }
          route={route.state === "ready" ? route.coordinates : null}
          fitKey={`${pickup?.lat}-${dropoff?.lat}-${position ? "p" : "n"}`}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-subtle px-3 py-2 text-xs text-ink-3">
        <span>
          {!live
            ? "Suivi en direct inactif pour cette course."
            : !position
              ? "Position du livreur pas encore reçue."
              : stale
                ? `Position obsolète — dernière mise à jour il y a ${formatDuration(age)}.`
                : `Position reçue il y a ${age !== null && age < 60 ? `${age} s` : formatDuration(age)}${position.accuracy ? ` · précision ± ${Math.round(position.accuracy)} m` : ""}.`}
        </span>
        <span>
          {route.state === "ready" && target
            ? `Itinéraire : ${(route.distanceMeters / 1000).toFixed(1).replace(".", ",")} km · ~${formatDuration(route.durationSeconds)}`
            : route.state === "disabled"
              ? "Itinéraire non configuré"
              : null}
        </span>
      </div>
    </div>
  );
}
