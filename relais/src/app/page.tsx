import Link from "next/link";
import { ArrowRight, Bike, Check, MapPin, MessageCircle, Package, ShieldCheck, Store, UserPlus } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { PlanCard } from "@/components/billing/plan-card";
import { getViewer } from "@/lib/auth";
import { getPublicPlans } from "@/lib/data/plans";
import { env } from "@/lib/env";
import { getI18n } from "@/i18n/server";

export default async function LandingPage() {
  const [viewer, plans, { t }] = await Promise.all([getViewer(), getPublicPlans(), getI18n()]);
  const signupHref = viewer ? "/home" : "/signup";

  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-5">
          <Brand />
          <nav className="hidden items-center gap-5 text-[13.5px] text-ink-2 md:flex" aria-label={t("Sections")}>
            <a href="#fonctionnalites" className="hover:text-ink">{t("Fonctionnalités")}</a>
            <a href="#tarifs" className="hover:text-ink">{t("Tarifs")}</a>
          </nav>
          <LanguageSwitcher className="ml-auto" />
          <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:items-center">
            <Button asChild variant="secondary" size="sm">
              <Link href="/courier">
                <Bike /> {t("Livreur")}
              </Link>
            </Button>
            {viewer ? (
              <Button asChild variant="primary" size="sm" className="col-span-2">
                <Link href="/home">{t("Mon espace")}</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/login">{t("Connexion")}</Link>
                </Button>
                <Button asChild variant="primary" size="sm">
                  <Link href="/signup">{t("Créer un compte")}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-12 px-4 pt-14 pb-14 sm:px-5 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:pt-20">
          <div>
            <p className="text-[13px] font-medium text-accent">{t("Pour les commerçants et leurs livreurs")}</p>
            <h1 className="mt-3 max-w-xl text-[30px] leading-[1.15] font-semibold tracking-[-0.025em] text-ink sm:text-[40px]">
              {t("Votre boutique, vos commandes et vos livreurs au même endroit.")}
            </h1>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink-2">
              {t(
                "{app} vous donne une boutique en ligne, un carnet de commandes (y compris WhatsApp) et une application pour les livreurs que vous parrainez. Tout fonctionne dans le navigateur, y compris sur le téléphone du livreur.",
                { app: env.appName },
              )}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild variant="primary" size="lg">
                <Link href={signupHref}>
                  {t("Créer un compte")} <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <a href="#tarifs">{t("Voir les tarifs")}</a>
              </Button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-ink-3">
              {[t("Gratuit pour commencer"), t("Paiement à la livraison et mobile money"), t("Liens WhatsApp prêts à envoyer")].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-success" /> {item}
                </li>
              ))}
            </ul>
          </div>

          <figure className="rounded-xl border border-line bg-canvas p-4 sm:p-5" aria-label={t("Déroulé d'une livraison")}>
            <ol className="flex flex-col gap-3">
              {[
                { icon: MessageCircle, title: t("Commande reçue"), text: t("Depuis votre boutique en ligne, WhatsApp ou par téléphone.") },
                { icon: Bike, title: t("Livreur de votre équipe"), text: t("Vous choisissez parmi vos livreurs, avec une suggestion selon leur disponibilité réelle.") },
                { icon: MapPin, title: t("Suivi partagé"), text: t("Étapes du colis ou position GPS du livreur en direct, selon votre plan.") },
                { icon: Package, title: t("Livraison confirmée"), text: t("Photo de preuve, encaissement déclaré, historique complet.") },
              ].map(({ icon: Icon, title, text }, i) => (
                <li key={title} className="flex gap-3 rounded-lg border border-line bg-surface p-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-ink text-white">
                    <Icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-[14px] font-medium">
                      <span className="mr-2 font-mono text-xs text-ink-4">0{i + 1}</span>
                      {title}
                    </p>
                    <p className="mt-0.5 text-[13px] text-ink-3">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </figure>
        </section>

        <section id="fonctionnalites" className="scroll-mt-4 border-t border-line bg-canvas">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-5 md:grid-cols-2">
            <div className="flex flex-col">
              <Store className="size-5 text-ink-2" />
              <h2 className="mt-3 text-[16px] font-semibold">{t("Pour les commerçants")}</h2>
              <ul className="mt-3 flex-1 space-y-2 text-[13.5px] text-ink-2">
                {[
                  t("Page publique avec catalogue et panier"),
                  t("Saisie rapide des commandes WhatsApp"),
                  t("Clients, stock, paiements et statistiques"),
                  t("Vos propres livreurs, invités par un lien"),
                  t("Équipe avec permissions configurables"),
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-ink-4" /> {item}
                  </li>
                ))}
              </ul>
              <Link href={signupHref} className="mt-4 inline-flex items-center gap-1 text-[13.5px] font-medium text-accent hover:underline">
                {t("Créer un compte")} <ArrowRight className="size-3.5" />
              </Link>
            </div>
            <div className="flex flex-col">
              <UserPlus className="size-5 text-ink-2" />
              <h2 className="mt-3 text-[16px] font-semibold">{t("Pour les livreurs parrainés")}</h2>
              <ul className="mt-3 flex-1 space-y-2 text-[13.5px] text-ink-2">
                {[
                  t("Pas d'inscription : l'accès s'active avec le lien envoyé par le commerçant"),
                  t("Application mobile dans le navigateur"),
                  t("Disponibilité en un geste"),
                  t("Navigation vers Google Maps ou Waze"),
                  t("Historique des courses et des encaissements"),
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-ink-4" /> {item}
                  </li>
                ))}
              </ul>
              <Link href="/courier" className="mt-4 inline-flex items-center gap-1 text-[13.5px] font-medium text-accent hover:underline">
                {t("Espace livreur")} <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </section>

        <section id="tarifs" className="scroll-mt-4 border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-5">
            <h2 className="text-[22px] font-semibold tracking-[-0.015em]">{t("Tarifs")}</h2>
            <p className="mt-1 max-w-2xl text-[13.5px] text-ink-3">
              {t("Commencez gratuitement. Passez à un plan payant quand vous avez besoin de livreurs et de suivi. Paiement mensuel par Orange Money ou MTN Mobile Money.")}
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.code}
                  plan={plan}
                  highlight={plan.code === "pro"}
                  action={
                    <Button asChild variant={plan.code === "pro" ? "primary" : "secondary"} className="w-full">
                      <Link href={viewer ? "/dashboard/billing" : "/signup"}>
                        {Number(plan.price_monthly) === 0 ? t("Commencer gratuitement") : t("Choisir ce plan")}
                      </Link>
                    </Button>
                  }
                />
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-5">
          <div className="flex gap-4 rounded-xl border border-line p-6 md:p-8">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-ink-2" />
            <div>
              <h2 className="text-[16px] font-semibold">{t("Données cloisonnées, position partagée seulement quand il le faut")}</h2>
              <p className="mt-1 max-w-2xl text-[13.5px] text-ink-3">
                {t(
                  "Chaque boutique dispose d'un espace isolé. La position d'un livreur n'est transmise que pendant une course ou lorsqu'il se déclare disponible, et l'historique GPS est supprimé automatiquement après la durée de conservation.",
                )}
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-ink-3 sm:px-5">
          <Brand size="sm" />
          <p>{t("Cartographie © contributeurs OpenStreetMap")}</p>
        </div>
      </footer>
    </div>
  );
}
