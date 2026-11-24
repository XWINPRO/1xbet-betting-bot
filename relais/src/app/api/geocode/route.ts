import { NextResponse } from "next/server";
import { geocode, reverseGeocode } from "@/lib/maps/geocoding";
import { mapServices } from "@/lib/server-env";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  if (!mapServices.geocoding) {
    return NextResponse.json({ enabled: false, results: [] }, { status: 200 });
  }
  if (!rateLimit(`geocode:${clientKey(request)}`, 20, 60_000)) {
    return NextResponse.json({ enabled: true, error: "too_many_requests" }, { status: 429 });
  }
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  try {
    if (url.searchParams.has("lat") && Number.isFinite(lat) && Number.isFinite(lng)) {
      const label = await reverseGeocode(lat, lng);
      return NextResponse.json({ enabled: true, label });
    }
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 200);
    if (q.length < 3) return NextResponse.json({ enabled: true, results: [] });
    const results = await geocode(q, url.searchParams.get("country") ?? "cm");
    return NextResponse.json({ enabled: true, results: results ?? [] });
  } catch {
    return NextResponse.json({ enabled: true, error: "unavailable", results: [] }, { status: 502 });
  }
}
