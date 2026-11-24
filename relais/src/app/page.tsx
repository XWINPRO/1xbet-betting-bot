import Link from "next/link";
import { ArrowRight, Bike, Check, MapPin, MessageCircle, Package, Send, ShieldCheck, Store, Truck } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { getViewer } from "@/lib/auth";
import { env } from "@/lib/env";

export default async function LandingPage() {
  const viewer = await getViewer();
  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
          <Brand />
          <nav className="hidden items-center gap-5 text-[13.5px] text-ink-2 md:flex">
            <Link href="/delivery" className="hover:text-ink">Envoyer un colis</Link>
            <Link href="/signup?intent=courier" className="hover:text-ink">Devenir livreur</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {viewer ? (
              <Button asChild variant="primary" size="sm">
                <Link href="/home">Mon espace</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/login">Connexion</Link>
                </Button>
                <Button asChild variant="primary" size="sm">
                  <Link href="/signup">Créer ma boutique</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-12 px-5 pt-16 pb-14 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:pt-20">
          <div>
            <p className="text-[13px] font-medium text-accent">Commerce et livraison, au même endroit</p>
            <h1 className="mt-3 max-w-xl text-[32px] leading-[1.15] font-semibold tracking-[-0.025em] text-ink sm:text-[40px]">
              Vendez, livrez et suivez chaque colis en temps réel.
            </h1>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink-2">
              {env.appName} réunit votre boutique en ligne, vos commandes WhatsApp, vos livreurs et un suivi GPS partageable avec vos clients. Sans installation : tout fonctionne dans le navigateur, y compris sur le téléphone du livreur.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild variant="primary" size="lg">
                <Link href={viewer ? "/home" : "/signup"}>
                  Créer ma boutique <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/delivery">Envoyer un colis</Link>
              </Button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-ink-3">
              {["Paiement à la livraison", "Orange Money et MTN MoMo (confirmation manuelle)", "Liens WhatsApp prêts à envoyer"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-success" /> {t}
                </li>
              ))}
            </ul>
          </div>

          <figure className="rounded-xl border border-line bg-canvas p-5" aria-label="Déroulé d'une livraison">
            <ol className="flex flex-col gap-3">
              {[
                { icon: MessageCircle, title: "Commande reçue", text: "Depuis la boutique en ligne, WhatsApp ou par téléphone." },
                { icon: Bike, title: "Livreur attribué", text: "Suggestion selon la disponibilité réelle et la distance. Vous choisissez." },
                { icon: MapPin, title: "Suivi partagé", text: "Le client suit la position transmise par le téléphone du livreur." },
                { icon: Package, title: "Livraison confirmée", text: "Photo de preuve, encaissement déclaré, historique complet." },
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

        <section className="border-t border-line bg-canvas">
          <div className="mx-auto grid max-w-6xl gap-px px-5 py-14 md:grid-cols-3 md:gap-8">
            {[
              {
                icon: Store,
                title: "Pour les boutiques",
                items: ["Page publique avec catalogue et panier", "Saisie rapide des commandes WhatsApp", "Clients, stock, paiements, statistiques", "Équipe avec permissions configurables"],
                cta: { href: viewer ? "/home" : "/signup", label: "Créer ma boutique" },
              },
              {
                icon: Send,
                title: "Pour envoyer un colis",
                items: ["Sans compte ni boutique", "Prix affiché avant confirmation", "Lien de suivi à partager", "Annulation tant que la course n'est pas prise"],
                cta: { href: "/delivery", label: "Demander une livraison" },
              },
              {
                icon: Truck,
                title: "Pour les livreurs",
                items: ["Application mobile dans le navigateur", "Disponibilité en un geste", "Navigation vers Google Maps ou Waze", "Historique des courses et encaissements"],
                cta: { href: "/signup?intent=courier", label: "Rejoindre le réseau" },
              },
            ].map(({ icon: Icon, title, items, cta }) => (
              <div key={title} className="flex flex-col py-6 md:py-0">
                <Icon className="size-5 text-ink-2" />
                <h2 className="mt-3 text-[16px] font-semibold">{title}</h2>
                <ul className="mt-3 flex-1 space-y-2 text-[13.5px] text-ink-2">
                  {items.map((i) => (
                    <li key={i} className="flex gap-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-ink-4" /> {i}
                    </li>
                  ))}
                </ul>
                <Link href={cta.href} className="mt-4 inline-flex items-center gap-1 text-[13.5px] font-medium text-accent hover:underline">
                  {cta.label} <ArrowRight className="size-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-14">
          <div className="flex flex-col gap-6 rounded-xl border border-line p-6 md:flex-row md:items-center md:justify-between md:p-8">
            <div className="flex gap-4">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-ink-2" />
              <div>
                <h2 className="text-[16px] font-semibold">Données cloisonnées, position partagée seulement quand il le faut</h2>
                <p className="mt-1 max-w-2xl text-[13.5px] text-ink-3">
                  Chaque boutique dispose d&apos;un espace isolé. La position d&apos;un livreur n&apos;est transmise que pendant une course ou lorsqu&apos;il se déclare disponible, et l&apos;historique GPS est supprimé automatiquement après la durée de conservation.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-xs text-ink-3">
          <Brand size="sm" />
          <p>Cartographie © contributeurs OpenStreetMap</p>
        </div>
      </footer>
    </div>
  );
}
