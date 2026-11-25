import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowUpRight, Bike } from "lucide-react";
import { Brand } from "@/components/brand";
import { getSiteUrl, requireViewer } from "@/lib/auth";
import { param } from "@/lib/utils";
import { CreateStoreForm } from "./create-store-form";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Démarrer") };
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireViewer("/onboarding");
  const sp = await searchParams;
  if (viewer.memberships.length > 0 && param(sp.new) !== "1") redirect("/dashboard");
  const site = await getSiteUrl();
  const host = site.replace(/^https?:\/\//, "");
  const { t } = await getI18n();

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="flex h-14 items-center justify-between gap-3 border-b border-line bg-surface px-4 sm:px-6">
        <Brand />
        <div className="flex items-center gap-2">
          <LanguageSwitcher compact />
          <SignOutButton variant="ghost" />
        </div>
      </header>
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[1fr_300px]">
        <section className="rounded-lg border border-line bg-surface p-6 shadow-xs sm:p-8">
          <p className="text-xs font-medium text-ink-3">{t("Étape 1 sur 1")}</p>
          <h1 className="mt-1 text-xl font-semibold tracking-[-0.01em]">{t("Créez votre boutique")}</h1>
          <p className="mt-1 mb-7 text-[13.5px] text-ink-3">
            {t("Votre espace est privé. Vous pourrez ajouter vos produits, vos livreurs et votre équipe juste après. Vous démarrez sur le plan gratuit.")}
          </p>
          <CreateStoreForm siteHost={host} />
        </section>
        <aside className="flex flex-col gap-3">
          <p className="text-[13px] font-medium text-ink-2">{t("Ce n'est pas ce que vous cherchez ?")}</p>
          {viewer.courier ? (
            <Link href="/courier" className="group flex items-start gap-3 rounded-lg border border-line bg-surface p-4 hover:border-line-strong">
              <Bike className="mt-0.5 size-4 text-ink-3" />
              <span className="flex-1 text-[13px]">
                <span className="block font-medium text-ink">{t("Espace livreur")}</span>
                <span className="text-ink-3">{t("Accéder à vos courses.")}</span>
              </span>
              <ArrowUpRight className="size-4 text-ink-4 group-hover:text-ink" />
            </Link>
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-line bg-surface p-4">
              <Bike className="mt-0.5 size-4 text-ink-3" />
              <span className="flex-1 text-[13px]">
                <span className="block font-medium text-ink">{t("Vous êtes livreur ?")}</span>
                <span className="text-ink-3">{t("Votre accès s'active avec le lien d'invitation envoyé par votre commerçant. Ouvrez ce lien pour rejoindre son équipe.")}</span>
              </span>
            </div>
          )}
          <p className="mt-2 text-xs text-ink-4">
            {t("Vous avez reçu une invitation d'une boutique ? Ouvrez simplement le lien reçu.")}
          </p>
        </aside>
      </div>
    </div>
  );
}
