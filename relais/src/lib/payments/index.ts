import type { PaymentMethod } from "@/types/domain";

/**
 * Paiements — état actuel : encaissement à la livraison et paiements
 * manuels confirmés par la boutique ou l'administrateur. Aucune transaction
 * de prestataire n'est simulée.
 *
 * Intégrations prévues (Mobile Money : Orange Money, MTN MoMo…) : implémenter
 * PaymentGateway puis l'enregistrer dans GATEWAYS. Tant qu'aucune passerelle
 * n'est enregistrée pour un moyen de paiement, celui-ci reste « manuel ».
 */
export type PaymentMethodInfo = {
  method: PaymentMethod;
  label: string;
  description: string;
  confirmation: "on_delivery" | "manual";
};

export const PAYMENT_METHODS: PaymentMethodInfo[] = [
  {
    method: "cash_on_delivery",
    label: "Paiement à la livraison",
    description: "Le livreur encaisse le montant à la remise du colis, puis le remet à la boutique.",
    confirmation: "on_delivery",
  },
  {
    method: "orange_money",
    label: "Orange Money",
    description: "Le client envoie le montant au numéro marchand ; la boutique confirme la réception manuellement.",
    confirmation: "manual",
  },
  {
    method: "mtn_momo",
    label: "MTN MoMo",
    description: "Le client envoie le montant au numéro marchand ; la boutique confirme la réception manuellement.",
    confirmation: "manual",
  },
  {
    method: "manual",
    label: "Virement ou dépôt",
    description: "Paiement hors plateforme confirmé manuellement.",
    confirmation: "manual",
  },
];

export interface PaymentGateway {
  method: PaymentMethod;
  /** Démarre un paiement et renvoie la référence du prestataire. */
  initiate(input: { amount: number; currency: string; phone: string; reference: string }): Promise<{ providerReference: string }>;
  /** Interroge le prestataire pour connaître l'état réel du paiement. */
  verify(providerReference: string): Promise<"pending" | "confirmed" | "failed">;
}

/** Aucune passerelle automatique n'est configurée dans cette version. */
export const GATEWAYS: Partial<Record<PaymentMethod, PaymentGateway>> = {};

export function isAutomated(method: PaymentMethod) {
  return Boolean(GATEWAYS[method]);
}
