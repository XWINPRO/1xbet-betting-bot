import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, Bike, Send } from "lucide-react";
import { Brand } from "@/components/brand";
import { getSiteUrl, requireViewer } from "@/lib/auth";
import { param } from "@/lib/utils";
import { CreateStoreForm } from "./create-store-form";
import { SignOutButton } from "@/components/layout/sign-out-button";

export const metadata = { title: "Démarrer" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireViewer("/onboarding");
  const sp = await searchParams;
  if (viewer.memberships.length > 0 && param(sp.new) !== "1") redirect("/dashboard");
  const site = await getSiteUrl();
  const host = site.replace(/^https?:\/\//, "");

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="flex h-14 items-center justify-between border-b border-line bg-surface px-6">
        <Brand />
        <SignOutButton variant="ghost" />
      </header>
      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-10 lg:grid-cols-[1fr_300px]">
        <section className="rounded-lg border border-line bg-surface p-6 shadow-xs sm:p-8">
          <p className="text-xs font-medium text-ink-3">Étape 1 sur 1</p>
          <h1 className="mt-1 text-xl font-semibold tracking-[-0.01em]">Créez votre boutique</h1>
          <p className="mt-1 mb-7 text-[13.5px] text-ink-3">
            Votre espace est privé. Vous pourrez ajouter vos produits, vos livreurs et votre équipe juste après.
          </p>
          <CreateStoreForm siteHost={host} />
        </section>
        <aside className="flex flex-col gap-3">
          <p className="text-[13px] font-medium text-ink-2">Ce n&apos;est pas ce que vous cherchez ?</p>
          {viewer.courier ? (
            <Link href="/courier" className="group flex items-start gap-3 rounded-lg border border-line bg-surface p-4 hover:border-line-strong">
              <Bike className="mt-0.5 size-4 text-ink-3" />
              <span className="flex-1 text-[13px]">
                <span className="block font-medium text-ink">Espace livreur</span>
                <span className="text-ink-3">Accéder à vos courses.</span>
              </span>
              <ArrowUpRight className="size-4 text-ink-4 group-hover:text-ink" />
            </Link>
          ) : (
            <Link href="/courier/apply" className="group flex items-start gap-3 rounded-lg border border-line bg-surface p-4 hover:border-line-strong">
              <Bike className="mt-0.5 size-4 text-ink-3" />
              <span className="flex-1 text-[13px]">
                <span className="block font-medium text-ink">Devenir livreur du réseau</span>
                <span className="text-ink-3">Soumettre votre profil à la validation.</span>
              </span>
              <ArrowUpRight className="size-4 text-ink-4 group-hover:text-ink" />
            </Link>
          )}
          <Link href="/delivery" className="group flex items-start gap-3 rounded-lg border border-line bg-surface p-4 hover:border-line-strong">
            <Send className="mt-0.5 size-4 text-ink-3" />
            <span className="flex-1 text-[13px]">
              <span className="block font-medium text-ink">Envoyer un colis</span>
              <span className="text-ink-3">Livraison ponctuelle, sans boutique.</span>
            </span>
            <ArrowUpRight className="size-4 text-ink-4 group-hover:text-ink" />
          </Link>
          <p className="mt-2 text-xs text-ink-4">
            Vous avez reçu une invitation d&apos;une boutique ? Ouvrez simplement le lien reçu.
          </p>
        </aside>
      </div>
    </div>
  );
}
