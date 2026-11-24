import "server-only";
import { serverEnv } from "@/lib/server-env";
import type { LatLng } from "@/lib/geo";

/**
 * Itinéraire via un serveur OSRM (ou compatible) configuré par ROUTING_URL.
 * Sans service configuré : null — l'interface n'affiche alors aucun trajet
 * ni aucune heure d'arrivée estimée.
 */
export type RouteResult = {
  distanceMeters: number;
  durationSeconds: number;
  coordinates: [number, number][]; // [lat, lng]
  provider: string;
};

export async function getRoute(from: LatLng, to: LatLng, profile = "driving"): Promise<RouteResult | null> {
  if (!serverEnv.routingUrl) return null;
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `${serverEnv.routingUrl}/route/v1/${profile}/${coords}?overview=full&geometries=geojson&alternatives=false&steps=false`;
  const res = await fetch(url, { next: { revalidate: 120 } });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    code: string;
    routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
  };
  const route = data.code === "Ok" ? data.routes?.[0] : undefined;
  if (!route) return null;
  return {
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    provider: "osrm",
  };
}
