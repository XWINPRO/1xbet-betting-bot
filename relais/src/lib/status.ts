import type {
  ClaimStatus,
  CourierAccountStatus,
  EffectiveCourierStatus,
  JobStatus,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductStatus,
  TransactionStatus,
} from "@/types/domain";

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "muted";
type Meta = { label: string; tone: Tone };

export const ORDER_STATUS: Record<OrderStatus, Meta> = {
  new: { label: "Nouvelle", tone: "accent" },
  confirmed: { label: "Confirmée", tone: "neutral" },
  preparing: { label: "En préparation", tone: "warning" },
  ready_for_pickup: { label: "Prête à être récupérée", tone: "warning" },
  handed_to_courier: { label: "Remise au livreur", tone: "accent" },
  in_transit: { label: "En cours de livraison", tone: "accent" },
  delivered: { label: "Livrée", tone: "success" },
  cancelled: { label: "Annulée", tone: "muted" },
  delivery_failed: { label: "Échec de livraison", tone: "danger" },
};

export const ORDER_STATUS_ORDER: OrderStatus[] = [
  "new",
  "confirmed",
  "preparing",
  "ready_for_pickup",
  "handed_to_courier",
  "in_transit",
  "delivered",
  "delivery_failed",
  "cancelled",
];

/** Miroir de public.order_transition_allowed() (la base reste l'autorité). */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ["confirmed", "preparing", "ready_for_pickup", "cancelled", "delivered"],
  confirmed: ["preparing", "ready_for_pickup", "cancelled", "delivered"],
  preparing: ["ready_for_pickup", "cancelled", "delivered"],
  ready_for_pickup: ["preparing", "handed_to_courier", "cancelled", "delivered"],
  handed_to_courier: ["in_transit", "delivered", "delivery_failed"],
  in_transit: ["delivered", "delivery_failed"],
  delivery_failed: ["ready_for_pickup", "cancelled", "delivered"],
  delivered: [],
  cancelled: [],
};

export const ORDER_ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  confirmed: "Confirmer",
  preparing: "Passer en préparation",
  ready_for_pickup: "Marquer prête",
  handed_to_courier: "Remise au livreur",
  in_transit: "En cours de livraison",
  delivered: "Marquer livrée",
  delivery_failed: "Signaler un échec",
  cancelled: "Annuler la commande",
};

export const ORDER_SOURCE: Record<OrderSource, string> = {
  storefront: "Boutique en ligne",
  whatsapp: "WhatsApp",
  manual: "Saisie manuelle",
  phone: "Téléphone",
  other: "Autre",
};

export const JOB_STATUS: Record<JobStatus, Meta> = {
  pending: { label: "En attente de livreur", tone: "warning" },
  offered: { label: "Proposée au livreur", tone: "accent" },
  accepted: { label: "Acceptée", tone: "accent" },
  picked_up: { label: "Colis récupéré", tone: "accent" },
  in_transit: { label: "En route", tone: "accent" },
  delivered: { label: "Livrée", tone: "success" },
  failed: { label: "Échec", tone: "danger" },
  cancelled: { label: "Annulée", tone: "muted" },
};

export const ACTIVE_JOB_STATUSES: JobStatus[] = ["offered", "accepted", "picked_up", "in_transit"];
export const LIVE_JOB_STATUSES: JobStatus[] = ["accepted", "picked_up", "in_transit"];
export const CLOSED_JOB_STATUSES: JobStatus[] = ["delivered", "failed", "cancelled"];

/** Étapes affichées sur la page de suivi publique. */
export const TRACKING_STEPS: { status: JobStatus; label: string; at: keyof import("@/types/domain").TrackingPayload["timestamps"] }[] = [
  { status: "pending", label: "Demande enregistrée", at: "created_at" },
  { status: "accepted", label: "Livreur en route vers le point de collecte", at: "accepted_at" },
  { status: "picked_up", label: "Colis récupéré", at: "picked_up_at" },
  { status: "in_transit", label: "En route vers vous", at: "in_transit_at" },
  { status: "delivered", label: "Livré", at: "delivered_at" },
];

export const PAYMENT_STATUS: Record<PaymentStatus, Meta> = {
  unpaid: { label: "Non payé", tone: "warning" },
  pending: { label: "À confirmer", tone: "warning" },
  paid: { label: "Payé", tone: "success" },
  refunded: { label: "Remboursé", tone: "muted" },
};

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  cash_on_delivery: "Paiement à la livraison",
  manual: "Virement ou dépôt",
  orange_money: "Orange Money",
  mtn_momo: "MTN MoMo",
  other: "Autre",
};

export const TRANSACTION_STATUS: Record<TransactionStatus, Meta> = {
  pending: { label: "À confirmer", tone: "warning" },
  confirmed: { label: "Confirmée", tone: "success" },
  failed: { label: "Échouée", tone: "danger" },
  refunded: { label: "Remboursée", tone: "muted" },
  cancelled: { label: "Annulée", tone: "muted" },
};

export const PRODUCT_STATUS: Record<ProductStatus, Meta> = {
  active: { label: "En vente", tone: "success" },
  inactive: { label: "Masqué", tone: "neutral" },
  archived: { label: "Archivé", tone: "muted" },
};

export const COURIER_STATUS: Record<EffectiveCourierStatus, Meta & { hint: string }> = {
  available: { label: "Disponible", tone: "success", hint: "Disponible, signal récent et capacité restante." },
  busy: { label: "En livraison", tone: "accent", hint: "Nombre maximal de courses actives atteint." },
  unavailable: { label: "Indisponible", tone: "neutral", hint: "Le livreur s'est déclaré indisponible." },
  offline: { label: "Hors ligne", tone: "muted", hint: "Aucun signal reçu récemment de son téléphone." },
  inactive: { label: "Inactif", tone: "muted", hint: "Compte non activé ou accès suspendu." },
};

export const COURIER_ACCOUNT: Record<CourierAccountStatus, Meta> = {
  invited: { label: "Invitation envoyée", tone: "neutral" },
  pending_review: { label: "En cours de validation", tone: "warning" },
  active: { label: "Actif", tone: "success" },
  suspended: { label: "Suspendu", tone: "danger" },
  rejected: { label: "Refusé", tone: "muted" },
};

export const VEHICLES: Record<string, string> = {
  moto: "Moto",
  velo: "Vélo",
  voiture: "Voiture",
  tricycle: "Tricycle",
  camionnette: "Camionnette",
  pieton: "À pied",
};

export const PACKAGE_TYPES: Record<string, string> = {
  document: "Document",
  small: "Petit colis",
  medium: "Colis moyen",
  large: "Grand colis",
  fragile: "Fragile",
  food: "Repas / alimentaire",
};

export const CLAIM_CATEGORY: Record<string, string> = {
  damaged: "Colis endommagé",
  late: "Retard",
  not_delivered: "Non livré",
  wrong_item: "Mauvais article",
  payment: "Paiement",
  behaviour: "Comportement",
  address: "Adresse introuvable",
  unreachable: "Destinataire injoignable",
  other: "Autre",
};

export const CLAIM_STATUS: Record<ClaimStatus, Meta> = {
  open: { label: "Ouverte", tone: "warning" },
  investigating: { label: "En cours", tone: "accent" },
  resolved: { label: "Résolue", tone: "success" },
  rejected: { label: "Rejetée", tone: "muted" },
};

export function toneOf<T extends string>(map: Record<T, Meta>, key: T | null | undefined): Meta {
  if (!key || !(key in map)) return { label: key ?? "—", tone: "neutral" };
  return map[key];
}
