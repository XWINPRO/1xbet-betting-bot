import "server-only";
import { serverEnv } from "@/lib/server-env";
import { env } from "@/lib/env";

/**
 * Géocodage via un service compatible Nominatim, uniquement s'il est
 * configuré (GEOCODING_URL). Politique d'usage Nominatim respectée :
 * recherche à la demande (pas d'autocomplétion), identification du client,
 * mise en cache des résultats.
 */
export type GeocodeResult = { label: string; lat: number; lng: number };

function userAgent() {
  return `${env.appName}/1.0${serverEnv.geocodingContact ? ` (${serverEnv.geocodingContact})` : ""}`;
}

export async function geocode(query: string, countryCodes = "cm"): Promise<GeocodeResult[] | null> {
  if (!serverEnv.geocodingUrl) return null;
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "5",
    addressdetails: "0",
    "accept-language": "fr",
  });
  if (countryCodes) params.set("countrycodes", countryCodes);
  const res = await fetch(`${serverEnv.geocodingUrl}/search?${params.toString()}`, {
    headers: { "User-Agent": userAgent(), Accept: "application/json" },
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`geocoding_failed_${res.status}`);
  const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  return data
    .map((d) => ({ label: d.display_name, lat: Number(d.lat), lng: Number(d.lon) }))
    .filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lng));
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (!serverEnv.geocodingUrl) return null;
  const params = new URLSearchParams({ lat: String(lat), lon: String(lng), format: "jsonv2", zoom: "18", "accept-language": "fr" });
  const res = await fetch(`${serverEnv.geocodingUrl}/reverse?${params.toString()}`, {
    headers: { "User-Agent": userAgent(), Accept: "application/json" },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { display_name?: string };
  return data.display_name ?? null;
}
