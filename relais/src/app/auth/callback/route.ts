import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeNext(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/home";
  return next;
}

/** Retour des liens e-mail (confirmation, réinitialisation) — flux PKCE. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
