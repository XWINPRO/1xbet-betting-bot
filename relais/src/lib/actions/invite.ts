"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { STORE_COOKIE, requireViewer } from "@/lib/auth";
import { fail, toUserMessage, type ActionResult } from "@/lib/errors";

export async function acceptInvitationAction(token: string): Promise<ActionResult> {
  await requireViewer(`/invite/${token}`);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error || !data) return fail(toUserMessage(error));
  const res = data as { kind: "staff" | "courier"; store_id: string };
  if (res.kind === "staff") {
    const cookieStore = await cookies();
    cookieStore.set(STORE_COOKIE, res.store_id, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365 });
    redirect("/dashboard");
  }
  redirect("/courier");
}
