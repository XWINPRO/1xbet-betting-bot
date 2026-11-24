"use client";

import * as React from "react";
import type { LatLng } from "@/lib/geo";

export type RouteState =
  | { state: "idle" | "loading" }
  | { state: "disabled" }
  | { state: "ready"; coordinates: [number, number][]; distanceMeters: number; durationSeconds: number }
  | { state: "unavailable" };

/**
 * Itinéraire réel si un service de routage est configuré côté serveur.
 * Sinon « disabled » : aucun trajet n'est dessiné ni estimé.
 */
export function useRoute(from: LatLng | null, to: LatLng | null, refreshKey?: string | number): RouteState {
  const [route, setRoute] = React.useState<RouteState>({ state: "idle" });
  const key = from && to ? `${from.lat.toFixed(4)},${from.lng.toFixed(4)}|${to.lat.toFixed(4)},${to.lng.toFixed(4)}|${refreshKey ?? ""}` : null;

  React.useEffect(() => {
    if (!key || !from || !to) {
      setRoute({ state: "idle" });
      return;
    }
    const controller = new AbortController();
    setRoute((r) => (r.state === "ready" ? r : { state: "loading" }));
    fetch(`/api/route?from=${from.lat},${from.lng}&to=${to.lat},${to.lng}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data: { enabled: boolean; route: null | { coordinates: [number, number][]; distanceMeters: number; durationSeconds: number } }) => {
        if (!data.enabled) setRoute({ state: "disabled" });
        else if (!data.route) setRoute({ state: "unavailable" });
        else setRoute({ state: "ready", ...data.route });
      })
      .catch((err) => {
        if (err?.name !== "AbortError") setRoute({ state: "unavailable" });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return route;
}
