"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { env } from "@/lib/env";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** Client Supabase côté navigateur (session partagée via cookies). */
export function getSupabaseBrowserClient() {
  if (!client) {
    client = createBrowserClient<Database>(env.supabaseUrl, env.supabaseKey);
  }
  return client;
}
