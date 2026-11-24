"use client";

import { MapView, type MapCourier } from "@/components/map";
import type { LatLng } from "@/lib/geo";

export function DeliveriesMap({
  store,
  couriers,
  dropoffs,
  height = 360,
}: {
  store: LatLng | null;
  couriers: MapCourier[];
  dropoffs: { id: string; lat: number; lng: number; label: string }[];
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <MapView pickup={store} couriers={couriers} markers={dropoffs.map((d) => ({ ...d, kind: "dropoff" as const }))} fitKey={`${couriers.length}-${dropoffs.length}`} zoom={13} />
    </div>
  );
}
