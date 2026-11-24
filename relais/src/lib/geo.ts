export type LatLng = { lat: number; lng: number };

export function isLatLng(value: unknown): value is LatLng {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.lat === "number" &&
    typeof v.lng === "number" &&
    Number.isFinite(v.lat) &&
    Number.isFinite(v.lng) &&
    Math.abs(v.lat) <= 90 &&
    Math.abs(v.lng) <= 180
  );
}

export function toLatLng(lat: number | null | undefined, lng: number | null | undefined): LatLng | null {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return null;
  const point = { lat: Number(lat), lng: Number(lng) };
  return isLatLng(point) ? point : null;
}

/** Distance orthodromique (à vol d'oiseau) en km. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371.0088;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Navigation externe : Google Maps (itinéraire vers la destination). */
export function googleMapsDirectionsUrl(to: LatLng, from?: LatLng | null) {
  const params = new URLSearchParams({ api: "1", destination: `${to.lat},${to.lng}`, travelmode: "driving" });
  if (from) params.set("origin", `${from.lat},${from.lng}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function googleMapsSearchUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function wazeUrl(to: LatLng) {
  return `https://waze.com/ul?ll=${to.lat},${to.lng}&navigate=yes`;
}

export function osmUrl(to: LatLng, zoom = 17) {
  return `https://www.openstreetmap.org/?mlat=${to.lat}&mlon=${to.lng}#map=${zoom}/${to.lat}/${to.lng}`;
}

export function formatCoords(p: LatLng) {
  return `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
}
