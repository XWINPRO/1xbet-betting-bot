"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/** Notifie le livreur des nouvelles propositions et rafraîchit ses données. */
export function CourierRealtime({ courierId }: { courierId: string }) {
  const router = useRouter();
  React.useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 500);
    };
    const channel = supabase
      .channel(`courier-${courierId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_jobs", filter: `courier_id=eq.${courierId}` }, (payload) => {
        const row = payload.new as { status?: string; reference?: string } | null;
        if (row?.status === "offered" && payload.eventType !== "DELETE") {
          toast.message(`Nouvelle course proposée${row.reference ? ` : ${row.reference}` : ""}`);
          if ("vibrate" in navigator) navigator.vibrate?.([180, 80, 180]);
        }
        refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_assignments", filter: `courier_id=eq.${courierId}` }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "couriers", filter: `id=eq.${courierId}` }, (payload) => {
        const before = payload.old as { account_status?: string; availability?: string };
        const after = payload.new as { account_status?: string; availability?: string };
        if (before.account_status !== after.account_status || before.availability !== after.availability) refresh();
      })
      .subscribe();
    // Filet de sécurité si le temps réel est interrompu (réseau mobile).
    const poll = setInterval(() => document.visibilityState === "visible" && router.refresh(), 45_000);
    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [courierId, router]);
  return null;
}
