import type { Metadata, Viewport } from "next";
import { LogoMark } from "@/components/brand";
import { StatusBadge } from "@/components/ui/badge";
import { CourierLocationProvider } from "@/components/courier/location-provider";
import { LocationStatusBar } from "@/components/courier/location-status";
import { CourierRealtime } from "@/components/courier/courier-realtime";
import { CourierBottomNav } from "@/components/courier/bottom-nav";
import { getCourierHome } from "@/lib/data/courier";
import { COURIER_STATUS } from "@/lib/status";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Espace livreur"), manifest: "/manifest.webmanifest" };
}
export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function CourierLayout({ children }: { children: React.ReactNode }) {
  const home = await getCourierHome();
  const { t } = await getI18n();
  const activeJob = home.active.length > 0;
  const canWork = home.courier.account_status === "active";
  const shouldShare = canWork && (activeJob || home.courier.availability === "available");

  return (
    <CourierLocationProvider shouldShare={shouldShare} activeJob={activeJob} settings={home.settings}>
      <CourierRealtime courierId={home.courier.id} />
      <div className="min-h-dvh bg-canvas pb-[calc(56px+env(safe-area-inset-bottom))]">
        <header className="sticky top-0 z-20 bg-surface">
          <div className="mx-auto flex h-14 max-w-xl items-center gap-3 border-b border-line px-4">
            <LogoMark size={24} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] leading-tight font-semibold">{home.courier.full_name}</p>
              <p className="text-[11.5px] leading-tight text-ink-3">{home.stores.map((s) => s.stores?.name).filter(Boolean).join(", ") || t("Livreur")}</p>
            </div>
            <StatusBadge map={COURIER_STATUS} value={home.effective} pulse={home.effective === "busy"} />
            <LanguageSwitcher compact />
          </div>
          <div className="mx-auto max-w-xl">{canWork ? <LocationStatusBar shouldShare={shouldShare} activeJob={activeJob} /> : null}</div>
        </header>
        <main className="mx-auto max-w-xl px-4 py-4">{children}</main>
        <CourierBottomNav />
      </div>
    </CourierLocationProvider>
  );
}
