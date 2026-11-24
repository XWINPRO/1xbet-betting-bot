import { phoneDigits } from "@/lib/phone";
import { formatMoney } from "@/lib/format";

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

function itemLines(items: Line[], currency?: string) {
  return items
    .map((i) => `• ${i.quantity} × ${i.name}${i.variant ? ` (${i.variant})` : ""}${i.total !== undefined && i.total !== null ? ` — ${formatMoney(i.total, currency)}` : ""}`)
    .join("\n");
}

export const waMessages = {
  orderConfirmation(p: { storeName: string; customerName: string; reference: string; items: Line[]; total: number | string; currency?: string; deliveryAddress?: string | null }) {
    return [
      `Bonjour ${p.customerName},`,
      `${p.storeName} confirme votre commande ${p.reference} :`,
      itemLines(p.items, p.currency),
      `Total : ${formatMoney(p.total, p.currency)}`,
      p.deliveryAddress ? `Livraison : ${p.deliveryAddress}` : "Retrait en boutique",
      "Merci pour votre confiance.",
    ].join("\n");
  },

  trackingLink(p: { storeName?: string | null; customerName?: string | null; reference: string; url: string; courierName?: string | null }) {
    return [
      p.customerName ? `Bonjour ${p.customerName},` : "Bonjour,",
      `${p.storeName ? `${p.storeName} : v` : "V"}otre livraison ${p.reference} est en cours de préparation.`,
      p.courierName ? `Livreur : ${p.courierName}.` : null,
      `Suivez-la en temps réel : ${p.url}`,
    ]
      .filter(Boolean)
      .join("\n");
  },

  courierMission(p: { reference: string; pickup: string; dropoff: string; collect?: number | string | null; currency?: string; url: string }) {
    return [
      `Nouvelle course ${p.reference}`,
      `Collecte : ${p.pickup}`,
      `Livraison : ${p.dropoff}`,
      p.collect && Number(p.collect) > 0 ? `À encaisser : ${formatMoney(p.collect, p.currency)}` : null,
      `Détails : ${p.url}`,
    ]
      .filter(Boolean)
      .join("\n");
  },

  courierToRecipient(p: { recipientName?: string | null; storeName?: string | null; reference: string }) {
    return `Bonjour${p.recipientName ? ` ${p.recipientName}` : ""}, je suis le livreur${p.storeName ? ` de ${p.storeName}` : ""} pour la livraison ${p.reference}. Je suis en route.`;
  },

  productShare(p: { storeName: string; productName: string; price: number | string; currency?: string; url: string }) {
    return `${p.productName} — ${formatMoney(p.price, p.currency)}\nChez ${p.storeName} : ${p.url}`;
  },

  storefrontOrder(p: { storeName: string; reference: string; customerName: string; items: Line[]; total: number | string; currency?: string; mode: "delivery" | "pickup"; address?: string | null }) {
    return [
      `Bonjour ${p.storeName},`,
      `Je viens de passer la commande ${p.reference} :`,
      itemLines(p.items, p.currency),
      `Total : ${formatMoney(p.total, p.currency)}`,
      p.mode === "delivery" ? `Livraison à : ${p.address ?? ""}` : "Je viendrai la récupérer en boutique.",
      `Nom : ${p.customerName}`,
    ].join("\n");
  },

  cartQuestion(p: { storeName: string; items: Line[]; total: number | string; currency?: string }) {
    return [`Bonjour ${p.storeName}, je suis intéressé(e) par :`, itemLines(p.items, p.currency), `Total estimé : ${formatMoney(p.total, p.currency)}`].join("\n");
  },

  onDemandTracking(p: { reference: string; url: string; senderName?: string | null }) {
    return `${p.senderName ? `${p.senderName} vous envoie un colis. ` : ""}Suivez la livraison ${p.reference} en temps réel : ${p.url}`;
  },

  courierInvite(p: { storeName: string; url: string }) {
    return `Bonjour, ${p.storeName} vous invite à rejoindre son équipe de livreurs sur Relais. Ouvrez ce lien sur votre téléphone pour activer votre accès : ${p.url}`;
  },

  staffInvite(p: { storeName: string; url: string }) {
    return `Bonjour, vous êtes invité(e) à rejoindre l'équipe de ${p.storeName} sur Relais : ${p.url}`;
  },
};
