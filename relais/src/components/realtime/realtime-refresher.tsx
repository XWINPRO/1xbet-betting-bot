"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Table = "orders" | "delivery_jobs" | "couriers" | "delivery_assignments";

/**
 * Écoute les changements (Supabase Realtime, filtrés par la RLS de
 * l'utilisateur) et rafraîchit les données serveur de la page.
 */
export function RealtimeRefresher({
  channel,
  tables,
  filter,
  debounceMs = 700,
}: {
  channel: string;
  tables: Table[];
  filter?: string;
  debounceMs?: number;
}) {
  const router = useRouter();
  const tablesKey = tables.join(",");

  React.useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), debounceMs);
    };
    const ch = supabase.channel(`rt:${channel}`);
    for (const table of tablesKey.split(",") as Table[]) {
      ch.on("postgres_changes", { event: "*", schema: "public", table, ...(filter ? { filter } : {}) }, refresh);
    }
    ch.subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(ch);
    };
  }, [channel, tablesKey, filter, debounceMs, router]);

  return null;
}
