import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TrackingView } from "@/components/tracking/tracking-view";
import { PublicHeader } from "@/components/layout/public-header";
import { env } from "@/lib/env";
import { getI18n } from "@/i18n/server";
import type { TrackingPayload } from "@/types/domain";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Suivi de livraison"), robots: { index: false, follow: false } };
}

export default async function TrackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) notFound();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("get_tracking", { p_token: token });
  if (!data) notFound();
  const tracking = data as unknown as TrackingPayload;
  const { t } = await getI18n();

  return (
    <div className="min-h-dvh bg-canvas">
      <PublicHeader store={tracking.store.name ? { name: tracking.store.name, slug: tracking.store.slug, logo_path: tracking.store.logo_path } : null} />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <TrackingView token={token} initial={tracking} />
        <p className="mt-8 text-center text-xs text-ink-4">
          {tracking.tracking_level === "live"
            ? t("Suivi fourni par {app}. La position affichée est celle transmise par le téléphone du livreur ; elle n'est visible que pendant la course.", { app: env.appName })
            : t("Suivi fourni par {app}.", { app: env.appName })}
        </p>
      </main>
    </div>
  );
}
