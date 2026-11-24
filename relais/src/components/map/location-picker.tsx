"use client";

import * as React from "react";
import { LocateFixed, MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import { MapView } from "@/components/map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LatLng } from "@/lib/geo";
import { formatCoords } from "@/lib/geo";
import { cn } from "@/lib/utils";

type GeocodeResult = { label: string; lat: number; lng: number };

/**
 * Sélection d'un point : clic sur la carte, déplacement du marqueur,
 * position actuelle (GPS du navigateur) ou recherche d'adresse si un
 * service de géocodage est configuré.
 */
export function LocationPicker({
  value,
  onChange,
  onAddress,
  kind = "point",
  className,
  height = 260,
}: {
  value: LatLng | null;
  onChange: (p: LatLng | null) => void;
  onAddress?: (label: string) => void;
  kind?: "pickup" | "dropoff" | "point";
  className?: string;
  height?: number;
}) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<GeocodeResult[] | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [geocodingEnabled, setGeocodingEnabled] = React.useState<boolean | null>(null);
  const [locating, setLocating] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/geocode?q=")
      .then((r) => r.json())
      .then((d: { enabled: boolean }) => setGeocodingEnabled(Boolean(d.enabled)))
      .catch(() => setGeocodingEnabled(false));
  }, []);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (query.trim().length < 3) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`);
      const data = (await res.json()) as { results?: GeocodeResult[]; error?: string };
      if (data.error === "too_many_requests") toast.error("Trop de recherches. Patientez un instant.");
      setResults(data.results ?? []);
    } catch {
      toast.error("Recherche d'adresse indisponible.");
    } finally {
      setSearching(false);
    }
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      toast.error("La géolocalisation n'est pas disponible sur cet appareil.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        if (pos.coords.accuracy > 100) toast.message(`Position approximative (± ${Math.round(pos.coords.accuracy)} m). Ajustez le marqueur si besoin.`);
      },
      (err) => {
        setLocating(false);
        toast.error(err.code === err.PERMISSION_DENIED ? "Autorisez l'accès à la localisation dans votre navigateur." : "Position introuvable. Placez le point manuellement.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-md border border-line-strong bg-surface", className)}>
      {geocodingEnabled ? (
        <div className="border-b border-line p-2">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void search();
                }
              }}
              placeholder="Rechercher une adresse, un quartier…"
              className="h-8"
              aria-label="Rechercher une adresse"
            />
            <Button type="button" size="sm" onClick={() => void search()} loading={searching}>
              <Search /> Chercher
            </Button>
          </div>
          {results ? (
            <ul className="mt-2 max-h-40 overflow-y-auto rounded-sm border border-line">
              {results.length === 0 ? <li className="px-3 py-2 text-[13px] text-ink-3">Aucun résultat.</li> : null}
              {results.map((r, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-[13px] text-ink-2 hover:bg-subtle"
                    onClick={() => {
                      onChange({ lat: r.lat, lng: r.lng });
                      onAddress?.(r.label);
                      setResults(null);
                    }}
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div style={{ height }} className="relative">
        <MapView picker={{ value, onChange: (p) => onChange(p), kind }} fitKey={value ? "has" : "none"} zoom={15} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2 text-xs text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="size-3.5" />
          {value ? formatCoords(value) : "Touchez la carte pour placer le point"}
        </span>
        <div className="flex items-center gap-1">
          {value ? (
            <Button type="button" size="xs" variant="ghost" onClick={() => onChange(null)}>
              Effacer
            </Button>
          ) : null}
          <Button type="button" size="xs" variant="secondary" onClick={locate} loading={locating}>
            <LocateFixed /> Ma position
          </Button>
        </div>
      </div>
    </div>
  );
}
