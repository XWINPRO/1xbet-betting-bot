import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { env } from "@/lib/env";

/**
 * Client Supabase côté serveur, authentifié avec la session de la requête.
 * Toutes les lectures passent par la RLS de l'utilisateur courant.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(env.supabaseUrl, env.supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Appelé depuis un Server Component : le proxy rafraîchit la session.
        }
      },
    },
  });
}

export type ServerSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;
