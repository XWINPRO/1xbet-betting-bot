"use client";

import * as React from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Suivi GPS réel du livreur.
 *
 * - La position n'est lue et transmise que si `shouldShare` est vrai :
 *   course active, ou livreur déclaré disponible (consentement explicite).
 * - Aucune position n'est jamais inventée : seules les mesures du capteur
 *   du téléphone (navigator.geolocation) sont envoyées, avec leur horodatage.
 * - Fréquence d'envoi configurable par l'administration (plus rapide en
 *   course, plus lente en attente) pour ménager la batterie.
 * - Limite des navigateurs mobiles : en arrière-plan ou écran verrouillé, la
 *   localisation peut être suspendue. L'interface le dit clairement et
 *   propose de garder l'écran allumé (Wake Lock) pendant une course.
 */

export type GeoState = "off" | "prompt" | "requesting" | "tracking" | "denied" | "unsupported" | "error";
export type Fix = { lat: number; lng: number; accuracy: number | null; heading: number | null; speed: number | null; at: number };

type Ctx = {
  geo: GeoState;
  sharing: boolean;
  lastFix: Fix | null;
  lastSentAt: number | null;
  lastError: string | null;
  intervalSeconds: number;
  start: () => void;
  wakeLock: { supported: boolean; active: boolean; toggle: () => void };
};

const LocationContext = React.createContext<Ctx | null>(null);

export function useCourierLocation() {
  const ctx = React.useContext(LocationContext);
  if (!ctx) throw new Error("useCourierLocation doit être utilisé dans CourierLocationProvider");
  return ctx;
}

type WakeLockSentinelLike = { release: () => Promise<void>; addEventListener: (t: "release", cb: () => void) => void };

export function CourierLocationProvider({
  shouldShare,
  activeJob,
  settings,
  children,
}: {
  shouldShare: boolean;
  activeJob: boolean;
  settings: { active_interval_s: number; idle_interval_s: number };
  children: React.ReactNode;
}) {
  const supabase = React.useMemo(() => getSupabaseBrowserClient(), []);
  const [geo, setGeo] = React.useState<GeoState>("off");
  const [lastFix, setLastFix] = React.useState<Fix | null>(null);
  const [lastSentAt, setLastSentAt] = React.useState<number | null>(null);
  const [lastError, setLastError] = React.useState<string | null>(null);
  const [wakeActive, setWakeActive] = React.useState(false);
  const [wakeWanted, setWakeWanted] = React.useState(false);

  const intervalSeconds = Math.max(3, activeJob ? settings.active_interval_s : settings.idle_interval_s);
  const watchId = React.useRef<number | null>(null);
  const fixRef = React.useRef<Fix | null>(null);
  const sentRef = React.useRef<number>(0);
  const sendingRef = React.useRef(false);
  const shareRef = React.useRef(shouldShare);
  const intervalRef = React.useRef(intervalSeconds);
  const wakeRef = React.useRef<WakeLockSentinelLike | null>(null);

  shareRef.current = shouldShare;
  intervalRef.current = intervalSeconds;

  const send = React.useCallback(
    async (force = false) => {
      const fix = fixRef.current;
      if (!fix || !shareRef.current || sendingRef.current) return;
      if (!force && Date.now() - sentRef.current < intervalRef.current * 1000) return;
      sendingRef.current = true;
      const { error } = await supabase.rpc("report_courier_location", {
        p_lat: fix.lat,
        p_lng: fix.lng,
        p_accuracy: fix.accuracy ?? undefined,
        p_heading: fix.heading ?? undefined,
        p_speed: fix.speed ?? undefined,
        p_recorded_at: new Date(fix.at).toISOString(),
      });
      sendingRef.current = false;
      if (error) {
        setLastError(navigator.onLine ? "Envoi de la position impossible, nouvel essai automatique." : "Pas de connexion internet : la position sera envoyée au retour du réseau.");
        return;
      }
      sentRef.current = Date.now();
      setLastSentAt(sentRef.current);
      setLastError(null);
    },
    [supabase],
  );

  const onPosition = React.useCallback(
    (pos: GeolocationPosition) => {
      const fix: Fix = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
        heading: pos.coords.heading !== null && Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
        speed: pos.coords.speed !== null && Number.isFinite(pos.coords.speed) ? pos.coords.speed : null,
        at: pos.timestamp || Date.now(),
      };
      fixRef.current = fix;
      setLastFix(fix);
      setGeo("tracking");
      void send();
    },
    [send],
  );

  const onError = React.useCallback((err: GeolocationPositionError) => {
    if (err.code === err.PERMISSION_DENIED) {
      setGeo("denied");
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    } else {
      setGeo((g) => (g === "tracking" ? g : "error"));
      setLastError(err.code === err.TIMEOUT ? "Signal GPS faible : recherche de la position…" : "Position indisponible pour le moment.");
    }
  }, []);

  const start = React.useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGeo("unsupported");
      return;
    }
    if (watchId.current !== null) return;
    setGeo((g) => (g === "tracking" ? g : "requesting"));
    watchId.current = navigator.geolocation.watchPosition(onPosition, onError, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 30000,
    });
  }, [onPosition, onError]);

  const stop = React.useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    fixRef.current = null;
    setLastFix(null);
    setGeo((g) => (g === "denied" || g === "unsupported" ? g : "off"));
  }, []);

  // Démarrage automatique seulement si la permission est déjà accordée ;
  // sinon le livreur déclenche la demande par un geste explicite.
  React.useEffect(() => {
    if (!shouldShare) {
      stop();
      return;
    }
    if (!("geolocation" in navigator)) {
      setGeo("unsupported");
      return;
    }
    let cancelled = false;
    const perms = (navigator as Navigator & { permissions?: Permissions }).permissions;
    if (perms?.query) {
      perms
        .query({ name: "geolocation" as PermissionName })
        .then((status) => {
          if (cancelled) return;
          if (status.state === "granted") start();
          else if (status.state === "denied") setGeo("denied");
          else setGeo((g) => (g === "tracking" ? g : "prompt"));
          status.onchange = () => {
            if (status.state === "granted" && shareRef.current) start();
            if (status.state === "denied") setGeo("denied");
          };
        })
        .catch(() => !cancelled && setGeo("prompt"));
    } else {
      setGeo("prompt");
    }
    return () => {
      cancelled = true;
    };
  }, [shouldShare, start, stop]);

  // Envoi périodique : si le téléphone ne produit pas de nouvelle mesure
  // (immobile), on demande une mesure fraîche plutôt que de renvoyer l'ancienne.
  React.useEffect(() => {
    if (!shouldShare || geo !== "tracking") return;
    const id = setInterval(() => {
      const fix = fixRef.current;
      if (fix && Date.now() - fix.at < intervalRef.current * 1000) {
        void send();
      } else {
        navigator.geolocation.getCurrentPosition(onPosition, onError, {
          enableHighAccuracy: true,
          maximumAge: intervalRef.current * 1000,
          timeout: 20000,
        });
      }
    }, intervalSeconds * 1000);
    return () => clearInterval(id);
  }, [shouldShare, geo, intervalSeconds, send, onPosition, onError]);

  // Signal de présence quand la position n'est pas partagée.
  React.useEffect(() => {
    if (shouldShare && geo === "tracking") return;
    const beat = () => {
      if (document.visibilityState === "visible") void supabase.rpc("courier_heartbeat");
    };
    beat();
    const id = setInterval(beat, 60_000);
    return () => clearInterval(id);
  }, [shouldShare, geo, supabase]);

  // Au retour au premier plan : nouvelle mesure immédiate et envoi.
  React.useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (shareRef.current && watchId.current !== null) {
        navigator.geolocation.getCurrentPosition(
          (p) => {
            onPosition(p);
            void send(true);
          },
          onError,
          { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
        );
      }
      if (wakeWanted && !wakeRef.current) void acquireWake();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPosition, onError, send, wakeWanted]);

  React.useEffect(() => () => stop(), [stop]);

  const wakeSupported = typeof navigator !== "undefined" && "wakeLock" in navigator;

  async function acquireWake() {
    try {
      const sentinel = (await (navigator as Navigator & { wakeLock: { request: (t: "screen") => Promise<WakeLockSentinelLike> } }).wakeLock.request("screen")) as WakeLockSentinelLike;
      wakeRef.current = sentinel;
      setWakeActive(true);
      sentinel.addEventListener("release", () => {
        wakeRef.current = null;
        setWakeActive(false);
      });
    } catch {
      setWakeActive(false);
    }
  }

  const toggleWake = React.useCallback(() => {
    if (wakeRef.current) {
      setWakeWanted(false);
      void wakeRef.current.release();
      wakeRef.current = null;
      setWakeActive(false);
    } else {
      setWakeWanted(true);
      void acquireWake();
    }
  }, []);

  // Relâche l'écran allumé quand la course se termine.
  React.useEffect(() => {
    if (!activeJob && wakeRef.current) {
      void wakeRef.current.release();
      setWakeWanted(false);
    }
  }, [activeJob]);

  const value: Ctx = {
    geo,
    sharing: shouldShare && geo === "tracking",
    lastFix,
    lastSentAt,
    lastError,
    intervalSeconds,
    start,
    wakeLock: { supported: wakeSupported, active: wakeActive, toggle: toggleWake },
  };

  return <LocationContext value={value}>{children}</LocationContext>;
}
