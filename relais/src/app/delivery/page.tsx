import Link from "next/link";
import { Brand } from "@/components/brand";
import { getViewer } from "@/lib/auth";
import { DeliveryForm } from "./delivery-form";

export const metadata = { title: "Envoyer un colis", description: "Demandez une livraison ponctuelle, voyez le prix avant de confirmer et suivez votre livreur en temps réel." };

export default async function DeliveryPage() {
  const viewer = await getViewer();
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Brand />
          {viewer ? (
            <Link href="/home" className="text-[13px] text-ink-3 hover:text-ink">
              Mon espace
            </Link>
          ) : (
            <Link href="/login?next=/delivery" className="text-[13px] text-ink-3 hover:text-ink">
              Se connecter
            </Link>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-xl font-semibold tracking-[-0.01em]">Envoyer un colis</h1>
        <p className="mt-1 mb-6 max-w-2xl text-[13.5px] text-ink-3">
          Livraison ponctuelle par un livreur du réseau, sans créer de boutique. Le prix s&apos;affiche avant confirmation ; vous recevez ensuite un lien de suivi en temps réel.
        </p>
        <DeliveryForm defaults={{ name: viewer?.profile.full_name ?? "", phone: viewer?.profile.phone ?? "" }} />
      </main>
    </div>
  );
}
