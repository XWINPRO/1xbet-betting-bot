"use client";

import "leaflet/dist/leaflet.css";
import * as React from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { env } from "@/lib/env";
import type { LatLng } from "@/lib/geo";

export type MapCourier = {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  accuracy?: number | null;
  stale?: boolean;
  status?: "available" | "busy" | "unavailable" | "offline" | "inactive";
  highlight?: boolean;
};

export type MapCanvasProps = {
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  couriers?: MapCourier[];
  route?: [number, number][] | null;
  className?: string;
  /** Change cette valeur pour recadrer la carte. */
  fitKey?: string | number;
  /** Mode sélection : clic / déplacement du marqueur. */
  picker?: { value: LatLng | null; onChange: (p: LatLng) => void; kind?: "pickup" | "dropoff" | "point" };
  zoom?: number;
  scrollWheelZoom?: boolean;
};

function pinIcon(letter: string, variant: "ink" | "accent" | "point") {
  const bg = variant === "ink" ? "#17202C" : variant === "accent" ? "#2563EB" : "#17202C";
  const html = `<div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-4px)">
    <div style="width:26px;height:26px;border-radius:7px;background:${bg};color:#fff;display:flex;align-items:center;justify-content:center;font:600 12px/1 var(--font-sans),system-ui;box-shadow:0 2px 6px rgba(23,32,44,.25),0 0 0 2px #fff">${letter}</div>
    <div style="width:2px;height:8px;background:${bg};margin-top:-1px"></div>
    <div style="width:6px;height:6px;border-radius:9px;background:${bg};box-shadow:0 0 0 2px #fff;margin-top:-1px"></div>
  </div>`;
  return L.divIcon({ html, className: "relais-marker", iconSize: [26, 42], iconAnchor: [13, 40] });
}

const STATUS_COLOR: Record<string, string> = {
  available: "#15803D",
  busy: "#2563EB",
  unavailable: "#697586",
  offline: "#9AA4B2",
  inactive: "#9AA4B2",
};

function courierIcon(c: MapCourier) {
  const color = c.stale ? "#9AA4B2" : c.status ? STATUS_COLOR[c.status] ?? "#2563EB" : "#2563EB";
  const size = c.highlight ? 18 : 14;
  const html = `<div style="width:${size}px;height:${size}px;border-radius:999px;background:${color};box-shadow:0 0 0 3px #fff,0 1px 6px rgba(23,32,44,.35)"></div>`;
  return L.divIcon({ html, className: "relais-marker", iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

function FitBounds({ points, fitKey, zoom }: { points: LatLng[]; fitKey?: string | number; zoom: number }) {
  const map = useMap();
  const key = `${fitKey ?? ""}|${points.length}`;
  const last = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (last.current === key) return;
    last.current = key;
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], Math.max(map.getZoom(), zoom), { animate: false });
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16, animate: false });
  }, [key, map, points, zoom]);
  return null;
}

function PickerEvents({ onChange }: { onChange: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

/** Corrige le rendu Leaflet lorsque le conteneur change de taille (onglets, panneaux). */
function InvalidateOnResize() {
  const map = useMap();
  React.useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

export default function MapCanvas({
  pickup,
  dropoff,
  couriers = [],
  route,
  className,
  fitKey,
  picker,
  zoom = 14,
  scrollWheelZoom = false,
}: MapCanvasProps) {
  const points: LatLng[] = [];
  if (pickup) points.push(pickup);
  if (dropoff) points.push(dropoff);
  for (const c of couriers) points.push({ lat: c.lat, lng: c.lng });
  if (picker?.value) points.push(picker.value);

  const center: [number, number] = points[0] ? [points[0].lat, points[0].lng] : env.mapCenter;

  return (
    <MapContainer
      center={center}
      zoom={points.length ? zoom : 12}
      scrollWheelZoom={scrollWheelZoom}
      className={className}
      style={{ width: "100%", height: "100%" }}
      attributionControl
    >
      <TileLayer url={env.tileUrl} attribution={env.tileAttribution} maxZoom={19} />
      <InvalidateOnResize />
      <FitBounds points={points} fitKey={fitKey} zoom={zoom} />

      {route && route.length > 1 ? (
        <Polyline positions={route} pathOptions={{ color: "#2563EB", weight: 4, opacity: 0.75 }} />
      ) : null}

      {pickup ? (
        <Marker position={[pickup.lat, pickup.lng]} icon={pinIcon("A", "ink")} keyboard={false}>
          <Tooltip direction="top" offset={[0, -36]}>
            Point de collecte
          </Tooltip>
        </Marker>
      ) : null}
      {dropoff ? (
        <Marker position={[dropoff.lat, dropoff.lng]} icon={pinIcon("B", "accent")} keyboard={false}>
          <Tooltip direction="top" offset={[0, -36]}>
            Destination
          </Tooltip>
        </Marker>
      ) : null}

      {couriers.map((c) => (
        <React.Fragment key={c.id}>
          {c.accuracy && c.accuracy > 15 && c.accuracy < 500 ? (
            <Circle
              center={[c.lat, c.lng]}
              radius={c.accuracy}
              pathOptions={{ color: c.stale ? "#9AA4B2" : "#2563EB", weight: 1, opacity: 0.4, fillOpacity: 0.08 }}
            />
          ) : null}
          <Marker position={[c.lat, c.lng]} icon={courierIcon(c)} keyboard={false}>
            {c.label ? (
              <Tooltip direction="top" offset={[0, -10]} permanent={Boolean(c.highlight)}>
                {c.label}
              </Tooltip>
            ) : null}
          </Marker>
        </React.Fragment>
      ))}

      {picker ? (
        <>
          <PickerEvents onChange={picker.onChange} />
          {picker.value ? (
            <Marker
              position={[picker.value.lat, picker.value.lng]}
              icon={pinIcon(picker.kind === "pickup" ? "A" : picker.kind === "dropoff" ? "B" : "•", picker.kind === "dropoff" ? "accent" : "ink")}
              draggable
              eventHandlers={{
                dragend(e) {
                  const ll = (e.target as L.Marker).getLatLng();
                  picker.onChange({ lat: ll.lat, lng: ll.lng });
                },
              }}
            />
          ) : null}
        </>
      ) : null}
    </MapContainer>
  );
}
