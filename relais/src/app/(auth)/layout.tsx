import { MapPin, MessageCircle, ShieldCheck, Truck } from "lucide-react";
import { Brand } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] xl:grid-cols-[minmax(0,1fr)_minmax(0,600px)]">
      <main className="flex flex-col bg-surface px-6 py-8 sm:px-12">
        <Brand />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[380px]">{children}</div>
        </div>
        <p className="text-xs text-ink-4">Vos données restent privées : chaque boutique dispose d&apos;un espace isolé.</p>
      </main>
      <aside className="hidden border-l border-line bg-canvas px-12 py-16 lg:flex lg:flex-col lg:justify-center">
        <div className="max-w-md">
          <p className="text-xs font-medium tracking-wide text-ink-3 uppercase">Commerce &amp; livraison</p>
          <h2 className="mt-3 text-[22px] leading-snug font-semibold tracking-[-0.015em] text-ink">
            De la commande WhatsApp à la remise du colis, tout est suivi au même endroit.
          </h2>
          <ul className="mt-8 space-y-5 text-[13.5px] text-ink-2">
            {[
              { icon: MessageCircle, title: "Commandes centralisées", text: "Boutique en ligne, WhatsApp ou téléphone : chaque commande a sa fiche et son historique." },
              { icon: Truck, title: "Vos livreurs, votre contrôle", text: "Disponibilité réelle, suggestion par distance, attribution en un clic." },
              { icon: MapPin, title: "Suivi GPS réel", text: "Position transmise par le téléphone du livreur, lien de suivi partageable." },
              { icon: ShieldCheck, title: "Accès cloisonnés", text: "Propriétaire, employés, livreurs : chacun ne voit que ce qui le concerne." },
            ].map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-line bg-surface">
                  <Icon className="size-4 text-ink-2" />
                </span>
                <span>
                  <span className="block font-medium text-ink">{title}</span>
                  <span className="text-ink-3">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
