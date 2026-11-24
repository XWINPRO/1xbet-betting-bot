import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { env } from "@/lib/env";

const PROTECTED_PREFIXES = ["/dashboard", "/courier", "/admin", "/onboarding", "/account"];

/**
 * Rafraîchit la session Supabase à chaque requête et redirige vers la
 * connexion les visiteurs non authentifiés qui tentent d'accéder à un
 * espace privé. Les contrôles d'autorisation fins sont faits côté serveur
 * (pages et actions) et en base (RLS).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!env.supabaseUrl || !env.supabaseKey) return response;

  const supabase = createServerClient<Database>(env.supabaseUrl, env.supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        if (headers) {
          for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
        }
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;

  if (!isAuthenticated && PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return response;
}
