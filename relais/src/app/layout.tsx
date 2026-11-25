import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import { env } from "@/lib/env";
import { I18nProvider } from "@/i18n/client";
import { getI18n } from "@/i18n/server";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { default: `${env.appName} — ${t("commerce et livraison")}`, template: `%s · ${env.appName}` },
    description: t("Gérez votre boutique, vos commandes, vos livreurs et suivez chaque livraison en temps réel."),
    applicationName: env.appName,
  };
}

export const viewport: Viewport = {
  themeColor: "#17202C",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale } = await getI18n();
  return (
    <html lang={locale} className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh">
        <I18nProvider locale={locale}>{children}</I18nProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: "!rounded-md !border !border-line !bg-surface !text-ink !shadow-pop !text-[13px] !font-sans",
              description: "!text-ink-3",
              error: "!text-danger-ink",
              success: "!text-ink",
            },
          }}
        />
      </body>
    </html>
  );
}
