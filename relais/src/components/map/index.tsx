"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/** Leaflet manipule le DOM : la carte n'est rendue que côté navigateur. */
export const MapView = dynamic(() => import("@/components/map/map-canvas"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

export type { MapCourier, MapCanvasProps } from "@/components/map/map-canvas";
