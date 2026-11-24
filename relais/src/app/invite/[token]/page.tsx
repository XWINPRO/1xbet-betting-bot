import Link from "next/link";
import type { Metadata } from "next";
import { Bike, Store } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/page";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { PERMISSION_LABEL } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { AcceptInvitationButton } from "./accept-button";

export const metadata: Metadata = { title: "Invitation", robots: { index: false } };

type Invitation = {
  kind: "staff" | "courier";
  store_name: string;
  label: string | null;
  courier_name: string | null;
  permissions: string[];
  expires_at: string;
  valid: boolean;
  reason: "revoked" | "used" | "expired" | "store_suspended" | null;
};

const REASONS: Record<string, string> = {
  revoked: "Cette invitation a été révoquée par la boutique.",
  used: "Cette invitation a déjà été utilisée.",
  expired: "Cette invitation a expiré. Demandez un nouveau lien à la boutique.",
  store_suspended: "Cette boutique est actuellement suspendue.",
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = /^[A-Za-z0-9_-]{32}$/.test(token) ? await supabase.rpc("get_invitation", { p_token: token }) : { data: null };
  const inv = data as unknown as Invitation | null;
  const viewer = await getViewer();
  const next = `/invite/${token}`;

  return (
    <div className="flex min-h-dvh flex-col items-center bg-canvas px-4 py-10">
      <Brand className="mb-8" />
      <div className="w-full max-w-md rounded-lg border border-line bg-surface p-6 shadow-xs">
        {!inv ? (
          <>
            <h1 className="text-lg font-semibold">Invitation introuvable</h1>
            <p className="mt-1 text-[13.5px] text-ink-3">Le lien est incomplet ou n&apos;existe pas. Vérifiez qu&apos;il a été copié en entier.</p>
          </>
        ) : (
          <>
            <span className="flex size-10 items-center justify-center rounded-md border border-line bg-subtle">
              {inv.kind === "courier" ? <Bike className="size-5 text-ink-2" /> : <Store className="size-5 text-ink-2" />}
            </span>
            <h1 className="mt-4 text-lg font-semibold">
              {inv.kind === "courier" ? `${inv.store_name} vous invite comme livreur` : `Rejoindre l'équipe de ${inv.store_name}`}
            </h1>
            <p className="mt-1 text-[13.5px] text-ink-3">
              {inv.kind === "courier"
                ? `Profil préparé au nom de ${inv.courier_name ?? "—"}. Vous recevrez les courses de la boutique et partagerez votre position pendant les livraisons.`
                : "Vous aurez accès à l'espace de la boutique avec les autorisations suivantes :"}
            </p>
            {inv.kind === "staff" ? (
              <ul className="mt-3 list-disc space-y-0.5 pl-5 text-[13.5px] text-ink-2">
                {inv.permissions.length ? inv.permissions.map((p) => <li key={p}>{PERMISSION_LABEL[p] ?? p}</li>) : <li>Consultation des commandes</li>}
              </ul>
            ) : null}
            <div className="mt-6">
              {!inv.valid ? (
                <Notice tone="warning">{REASONS[inv.reason ?? ""] ?? "Invitation non valide."}</Notice>
              ) : viewer ? (
                <>
                  <p className="mb-3 text-xs text-ink-3">Connecté en tant que {viewer.email}. Expire le {formatDate(inv.expires_at)}.</p>
                  <AcceptInvitationButton token={token} label="Accepter l'invitation" />
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <Button asChild size="lg" variant="primary" block>
                    <Link href={`/signup?next=${encodeURIComponent(next)}${inv.kind === "courier" ? "&intent=courier" : ""}`}>Créer mon compte</Link>
                  </Button>
                  <Button asChild size="lg" variant="secondary" block>
                    <Link href={`/login?next=${encodeURIComponent(next)}`}>J&apos;ai déjà un compte</Link>
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
