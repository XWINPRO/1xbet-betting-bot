import { NextResponse } from "next/server";
import { getRoute } from "@/lib/maps/routing";
import { mapServices } from "@/lib/server-env";
import { clientKey, rateLimit } from "@/lib/rate-limit";

function parsePoint(value: string | null) {
  if (!value) return null;
  const [lat, lng] = value.split(",").map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export async function GET(request: Request) {
  if (!mapServices.routing) return NextResponse.json({ enabled: false, route: null });
  if (!rateLimit(`route:${clientKey(request)}`, 60, 60_000)) {
    return NextResponse.json({ enabled: true, error: "too_many_requests" }, { status: 429 });
  }
  const url = new URL(request.url);
  const from = parsePoint(url.searchParams.get("from"));
  const to = parsePoint(url.searchParams.get("to"));
  if (!from || !to) return NextResponse.json({ enabled: true, error: "invalid_points" }, { status: 400 });
  try {
    const route = await getRoute(from, to);
    return NextResponse.json({ enabled: true, route });
  } catch {
    return NextResponse.json({ enabled: true, route: null, error: "unavailable" }, { status: 502 });
  }
}
