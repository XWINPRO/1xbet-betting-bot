import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import { env } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${env.appName} — commerce et livraison`, template: `%s · ${env.appName}` },
  description: "Gérez votre boutique, vos commandes, vos livreurs et suivez chaque livraison en temps réel.",
  applicationName: env.appName,
};

export const viewport: Viewport = {
  themeColor: "#17202C",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh">
        {children}
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
