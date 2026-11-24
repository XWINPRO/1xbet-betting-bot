"use client";

import { MapView, type MapCourier } from "@/components/map";
import type { LatLng } from "@/lib/geo";

export function CouriersMap({ couriers, store, height = 320 }: { couriers: MapCourier[]; store: LatLng | null; height?: number }) {
  return (
    <div style={{ height }} className="relative">
      <MapView pickup={store} couriers={couriers} fitKey={couriers.map((c) => c.id).join(",")} zoom={13} />
    </div>
  );
}
