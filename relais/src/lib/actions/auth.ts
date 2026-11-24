"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/auth";
import { loginSchema, passwordSchema, signupSchema } from "@/lib/validation/schemas";
import { fail, toUserMessage, zodFieldErrors, type ActionResult } from "@/lib/errors";
import { z } from "zod";

/** N'autorise que des redirections internes. */
function safeNext(next: string | null | undefined, fallback = "/home") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

const INTENT_HOME: Record<string, string> = {
  merchant: "/onboarding",
  courier: "/courier/apply",
  customer: "/delivery",
};

export async function signInAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Vérifiez les champs.", zodFieldErrors(parsed.error.issues));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) return fail(toUserMessage(error, "Connexion impossible."));
  redirect(safeNext(parsed.data.next));
}

export async function signUpAction(_prev: ActionResult<{ email: string }> | null, formData: FormData): Promise<ActionResult<{ email: string }>> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Vérifiez les champs.", zodFieldErrors(parsed.error.issues));
  const { email, password, full_name, phone, intent } = parsed.data;
  const target = safeNext(parsed.data.next, INTENT_HOME[intent] ?? "/home");
  const site = await getSiteUrl();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name, phone, intent },
      emailRedirectTo: `${site}/auth/callback?next=${encodeURIComponent(target)}`,
    },
  });
  if (error) return fail(toUserMessage(error, "Inscription impossible."));
  // Confirmation e-mail désactivée : la session est ouverte immédiatement.
  if (data.session) redirect(target);
  return { ok: true, data: { email }, message: "confirm_email" };
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordResetAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = z.object({ email: z.email("Adresse e-mail invalide").trim().toLowerCase() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Adresse e-mail invalide.", zodFieldErrors(parsed.error.issues));
  const site = await getSiteUrl();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${site}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
  });
  // Réponse identique que le compte existe ou non (pas d'énumération).
  if (error && /rate limit/i.test(error.message)) return fail(toUserMessage(error));
  return { ok: true, data: null, message: "sent" };
}

export async function updatePasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Vérifiez les champs.", zodFieldErrors(parsed.error.issues));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(toUserMessage(error, "Mise à jour impossible. Le lien a peut-être expiré."));
  redirect("/home");
}
