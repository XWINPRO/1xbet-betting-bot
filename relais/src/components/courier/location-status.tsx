"use client";

import * as React from "react";
import { LocateFixed, LocateOff, MapPinOff, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCourierLocation } from "@/components/courier/location-provider";
import { cn } from "@/lib/utils";

function useNow(ms = 5000) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Bandeau d'état de la localisation, toujours visible du livreur. */
export function LocationStatusBar({ shouldShare, activeJob }: { shouldShare: boolean; activeJob: boolean }) {
  const { geo, lastFix, lastSentAt, lastError, start, wakeLock, intervalSeconds } = useCourierLocation();
  const now = useNow();

  if (!shouldShare) {
    return (
      <div className="flex items-center gap-2 border-b border-line bg-subtle px-4 py-2 text-xs text-ink-3">
        <LocateOff className="size-3.5" />
        Localisation non partagée — vous êtes indisponible et sans course.
      </div>
    );
  }

  if (geo === "denied") {
    return (
      <div className="flex items-start gap-2 border-b border-danger/20 bg-danger-soft px-4 py-2.5 text-xs text-danger-ink">
        <MapPinOff className="mt-px size-3.5 shrink-0" />
        <span>Localisation refusée. Autorisez-la dans les réglages du navigateur (icône du cadenas → Position), puis rechargez la page.</span>
      </div>
    );
  }

  if (geo === "unsupported") {
    return <div className="border-b border-danger/20 bg-danger-soft px-4 py-2.5 text-xs text-danger-ink">Ce navigateur ne permet pas la localisation. Utilisez Chrome ou Safari à jour.</div>;
  }

  if (geo !== "tracking") {
    return (
      <div className="flex items-center gap-3 border-b border-warning/25 bg-warning-soft px-4 py-2.5 text-xs text-warning-ink">
        <LocateFixed className="size-4 shrink-0" />
        <span className="flex-1">{geo === "requesting" ? "Recherche de votre position…" : activeJob ? "Activez la localisation pour que le client suive la livraison." : "Activez la localisation pour être visible des boutiques."}</span>
        {geo !== "requesting" ? (
          <Button size="sm" variant="primary" onClick={start}>
            Activer
          </Button>
        ) : null}
      </div>
    );
  }

  const fixAge = lastFix ? Math.round((now - lastFix.at) / 1000) : null;
  const sentAge = lastSentAt ? Math.round((now - lastSentAt) / 1000) : null;
  return (
    <div className="border-b border-success/20 bg-success-soft/70 px-4 py-2 text-xs text-success">
      <div className="flex items-center gap-2">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-pulse-dot rounded-full bg-success" />
        </span>
        <span className="flex-1 font-medium">
          Position partagée {activeJob ? "avec la boutique et le client" : "avec vos boutiques"}
          {lastFix?.accuracy ? <span className="font-normal opacity-80"> · ± {Math.round(lastFix.accuracy)} m</span> : null}
        </span>
        <span className={cn("tabular opacity-80", lastError && "text-warning-ink")}>{sentAge !== null ? `envoyée il y a ${sentAge} s` : fixAge !== null ? "envoi…" : ""}</span>
      </div>
      {lastError ? <p className="mt-1 text-warning-ink">{lastError}</p> : null}
      {activeJob ? (
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11.5px] text-ink-3">
          <span>Mise à jour toutes les {intervalSeconds} s. Gardez l&apos;application ouverte : en arrière-plan, le téléphone peut suspendre le GPS.</span>
          {wakeLock.supported ? (
            <button type="button" onClick={wakeLock.toggle} className={cn("inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 font-medium", wakeLock.active ? "bg-ink text-white" : "bg-surface text-ink ring-1 ring-line")}>
              <Sun className="size-3" /> {wakeLock.active ? "Écran maintenu" : "Garder l'écran allumé"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
