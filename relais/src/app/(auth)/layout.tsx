import { MapPin, MessageCircle, ShieldCheck, Truck } from "lucide-react";
import { Brand } from "@/components/brand";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { getI18n } from "@/i18n/server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] xl:grid-cols-[minmax(0,1fr)_minmax(0,600px)]">
      <main className="flex flex-col bg-surface px-4 py-6 sm:px-12 sm:py-8">
        <div className="flex items-center justify-between gap-3">
          <Brand />
          <LanguageSwitcher />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[380px]">{children}</div>
        </div>
        <p className="text-xs text-ink-4">{t("Vos données restent privées : chaque boutique dispose d'un espace isolé.")}</p>
      </main>
      <aside className="hidden border-l border-line bg-canvas px-12 py-16 lg:flex lg:flex-col lg:justify-center">
        <div className="max-w-md">
          <p className="text-xs font-medium tracking-wide text-ink-3 uppercase">{t("Commerce et livraison")}</p>
          <h2 className="mt-3 text-[22px] leading-snug font-semibold tracking-[-0.015em] text-ink">
            {t("De la commande WhatsApp à la remise du colis, tout est suivi au même endroit.")}
          </h2>
          <ul className="mt-8 space-y-5 text-[13.5px] text-ink-2">
            {[
              { icon: MessageCircle, title: t("Commandes centralisées"), text: t("Boutique en ligne, WhatsApp ou téléphone : chaque commande a sa fiche et son historique.") },
              { icon: Truck, title: t("Vos livreurs, votre contrôle"), text: t("Vous parrainez vos livreurs ; disponibilité réelle et attribution en un clic.") },
              { icon: MapPin, title: t("Suivi des livraisons"), text: t("Étapes du colis ou position GPS en direct selon votre plan, lien de suivi partageable.") },
              { icon: ShieldCheck, title: t("Accès cloisonnés"), text: t("Propriétaire, employés, livreurs : chacun ne voit que ce qui le concerne.") },
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
