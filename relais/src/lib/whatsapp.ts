import { phoneDigits } from "@/lib/phone";
import type { I18n } from "@/i18n/translate";

/**
 * WhatsApp — version 1 : liens « click to chat » (wa.me) avec messages
 * préremplis. L'utilisateur envoie lui-même le message depuis WhatsApp.
 * Aucun envoi automatique n'a lieu tant que l'API WhatsApp Business n'est
 * pas configurée (voir lib/messaging).
 */
export function whatsappUrl(phone: string | null | undefined, text?: string): string | null {
  const digits = phoneDigits(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** Partage libre : l'utilisateur choisit le destinataire dans WhatsApp. */
export function whatsappShareUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

type Line = { name: string; quantity: number; variant?: string | null; total?: number | string | null };
type Tools = Pick<I18n, "t" | "f">;

function itemLines(f: Tools["f"], items: Line[], currency?: string) {
  return items
    .map((i) => `• ${i.quantity} × ${i.name}${i.variant ? ` (${i.variant})` : ""}${i.total !== undefined && i.total !== null ? ` — ${f.money(i.total, currency)}` : ""}`)
    .join("\n");
}

/** Messages préremplis, dans la langue de l'interface de l'expéditeur. */
export function waMessages({ t, f }: Tools) {
  return {
    orderConfirmation(p: { storeName: string; customerName: string; reference: string; items: Line[]; total: number | string; currency?: string; deliveryAddress?: string | null }) {
      return [
        t("Bonjour {name},", { name: p.customerName }),
        t("{store} confirme votre commande {ref} :", { store: p.storeName, ref: p.reference }),
        itemLines(f, p.items, p.currency),
        t("Total : {amount}", { amount: f.money(p.total, p.currency) }),
        p.deliveryAddress ? t("Livraison : {address}", { address: p.deliveryAddress }) : t("Retrait en boutique"),
        t("Merci pour votre confiance."),
      ].join("\n");
    },

    trackingLink(p: { storeName?: string | null; customerName?: string | null; reference: string; url: string; courierName?: string | null }) {
      return [
        p.customerName ? t("Bonjour {name},", { name: p.customerName }) : t("Bonjour,"),
        p.storeName
          ? t("{store} : votre livraison {ref} est en cours de préparation.", { store: p.storeName, ref: p.reference })
          : t("Votre livraison {ref} est en cours de préparation.", { ref: p.reference }),
        p.courierName ? t("Livreur : {name}.", { name: p.courierName }) : null,
        t("Suivez-la en temps réel : {url}", { url: p.url }),
      ]
        .filter(Boolean)
        .join("\n");
    },

    trackingSteps(p: { storeName?: string | null; customerName?: string | null; reference: string; url: string }) {
      return [
        p.customerName ? t("Bonjour {name},", { name: p.customerName }) : t("Bonjour,"),
        p.storeName
          ? t("{store} : votre livraison {ref} est en cours de préparation.", { store: p.storeName, ref: p.reference })
          : t("Votre livraison {ref} est en cours de préparation.", { ref: p.reference }),
        t("Suivez les étapes de la livraison : {url}", { url: p.url }),
      ].join("\n");
    },

    courierMission(p: { reference: string; pickup: string; dropoff: string; collect?: number | string | null; currency?: string; url: string }) {
      return [
        t("Nouvelle course {ref}", { ref: p.reference }),
        t("Collecte : {address}", { address: p.pickup }),
        t("Livraison : {address}", { address: p.dropoff }),
        p.collect && Number(p.collect) > 0 ? t("À encaisser : {amount}", { amount: f.money(p.collect, p.currency) }) : null,
        t("Détails : {url}", { url: p.url }),
      ]
        .filter(Boolean)
        .join("\n");
    },

    courierToRecipient(p: { recipientName?: string | null; storeName?: string | null; reference: string }) {
      const hello = p.recipientName ? t("Bonjour {name},", { name: p.recipientName }) : t("Bonjour,");
      const who = p.storeName
        ? t("je suis le livreur de {store} pour la livraison {ref}. Je suis en route.", { store: p.storeName, ref: p.reference })
        : t("je suis le livreur pour la livraison {ref}. Je suis en route.", { ref: p.reference });
      return `${hello} ${who}`;
    },

    productShare(p: { storeName: string; productName: string; price: number | string; currency?: string; url: string }) {
      return `${p.productName} — ${f.money(p.price, p.currency)}\n${t("Chez {store} : {url}", { store: p.storeName, url: p.url })}`;
    },

    storefrontOrder(p: { storeName: string; reference: string; customerName: string; items: Line[]; total: number | string; currency?: string; mode: "delivery" | "pickup"; address?: string | null }) {
      return [
        t("Bonjour {name},", { name: p.storeName }),
        t("Je viens de passer la commande {ref} :", { ref: p.reference }),
        itemLines(f, p.items, p.currency),
        t("Total : {amount}", { amount: f.money(p.total, p.currency) }),
        p.mode === "delivery" ? t("Livraison à : {address}", { address: p.address ?? "" }) : t("Je viendrai la récupérer en boutique."),
        t("Nom : {name}", { name: p.customerName }),
      ].join("\n");
    },

    cartQuestion(p: { storeName: string; items: Line[]; total: number | string; currency?: string }) {
      return [
        t("Bonjour {store}, je suis intéressé(e) par :", { store: p.storeName }),
        itemLines(f, p.items, p.currency),
        t("Total estimé : {amount}", { amount: f.money(p.total, p.currency) }),
      ].join("\n");
    },

    recipientTracking(p: { reference: string; url: string; storeName?: string | null }) {
      return p.storeName
        ? t("{store} vous envoie un colis. Suivez la livraison {ref} : {url}", { store: p.storeName, ref: p.reference, url: p.url })
        : t("Suivez la livraison {ref} : {url}", { ref: p.reference, url: p.url });
    },

    courierInvite(p: { storeName: string; url: string }) {
      return t("Bonjour, {store} vous invite à rejoindre son équipe de livreurs sur Relais. Ouvrez ce lien sur votre téléphone pour activer votre accès : {url}", { store: p.storeName, url: p.url });
    },

    staffInvite(p: { storeName: string; url: string }) {
      return t("Bonjour, vous êtes invité(e) à rejoindre l'équipe de {store} sur Relais : {url}", { store: p.storeName, url: p.url });
    },
  };
}
