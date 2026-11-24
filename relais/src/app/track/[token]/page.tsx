import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/auth";
import { param } from "@/lib/utils";
import { whatsappShareUrl, waMessages } from "@/lib/whatsapp";
import { TrackingView } from "@/components/tracking/tracking-view";
import { PublicHeader } from "@/components/layout/public-header";
import { Notice } from "@/components/ui/page";
import { CopyButton } from "@/components/ui/client-helpers";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { env } from "@/lib/env";
import type { TrackingPayload } from "@/types/domain";

export const metadata: Metadata = { title: "Suivi de livraison", robots: { index: false, follow: false } };

export default async function TrackPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  const sp = await searchParams;
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) notFound();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("get_tracking", { p_token: token });
  if (!data) notFound();
  const tracking = data as unknown as TrackingPayload;
  const isNew = param(sp.new) === "1";
  const url = `${await getSiteUrl()}/track/${token}`;

  return (
    <div className="min-h-dvh bg-canvas">
      <PublicHeader store={tracking.store} />
      <main className="mx-auto max-w-2xl px-4 py-6">
        {isNew ? (
          <Notice tone="success" className="mb-4" title={`Demande ${tracking.reference} enregistrée`}>
            <p>Partagez ce lien avec le destinataire pour qu&apos;il suive la livraison. Gardez-le : il permet aussi d&apos;annuler tant qu&apos;aucun livreur n&apos;a pris la course.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <CopyButton value={url} label="Copier le lien" />
              <WhatsAppButton size="sm" label="Envoyer au destinataire" href={whatsappShareUrl(waMessages.onDemandTracking({ reference: tracking.reference, url }))} />
            </div>
          </Notice>
        ) : null}
        <TrackingView token={token} initial={tracking} />
        <p className="mt-8 text-center text-xs text-ink-4">
          Suivi fourni par {env.appName}. La position affichée est celle transmise par le téléphone du livreur ; elle n&apos;est visible que pendant la course.
        </p>
      </main>
    </div>
  );
}
