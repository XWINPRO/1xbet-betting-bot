import { msg } from "@/i18n/msg";
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
  Enums,
} from "@/types/domain";

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "muted";
type Meta = { label: string; tone: Tone };

export const ORDER_STATUS: Record<OrderStatus, Meta> = {
  new: { label: msg("Nouvelle"), tone: "accent" },
  confirmed: { label: msg("Confirmée"), tone: "neutral" },
  preparing: { label: msg("En préparation"), tone: "warning" },
  ready_for_pickup: { label: msg("Prête à être récupérée"), tone: "warning" },
  handed_to_courier: { label: msg("Remise au livreur"), tone: "accent" },
  in_transit: { label: msg("En cours de livraison"), tone: "accent" },
  delivered: { label: msg("Livrée"), tone: "success" },
  cancelled: { label: msg("Annulée"), tone: "muted" },
  delivery_failed: { label: msg("Échec de livraison"), tone: "danger" },
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
  confirmed: msg("Confirmer"),
  preparing: msg("Passer en préparation"),
  ready_for_pickup: msg("Marquer prête"),
  handed_to_courier: msg("Remise au livreur"),
  in_transit: msg("En cours de livraison"),
  delivered: msg("Marquer livrée"),
  delivery_failed: msg("Signaler un échec"),
  cancelled: msg("Annuler la commande"),
};

export const ORDER_SOURCE: Record<OrderSource, string> = {
  storefront: msg("Boutique en ligne"),
  whatsapp: msg("WhatsApp"),
  manual: msg("Saisie manuelle"),
  phone: msg("Téléphone"),
  other: msg("Autre"),
};

export const JOB_STATUS: Record<JobStatus, Meta> = {
  pending: { label: msg("En attente de livreur"), tone: "warning" },
  offered: { label: msg("Proposée au livreur"), tone: "accent" },
  accepted: { label: msg("Acceptée"), tone: "accent" },
  picked_up: { label: msg("Colis récupéré"), tone: "accent" },
  in_transit: { label: msg("En route"), tone: "accent" },
  delivered: { label: msg("Livrée"), tone: "success" },
  failed: { label: msg("Échec"), tone: "danger" },
  cancelled: { label: msg("Annulée"), tone: "muted" },
};

export const ACTIVE_JOB_STATUSES: JobStatus[] = ["offered", "accepted", "picked_up", "in_transit"];
export const LIVE_JOB_STATUSES: JobStatus[] = ["accepted", "picked_up", "in_transit"];
export const CLOSED_JOB_STATUSES: JobStatus[] = ["delivered", "failed", "cancelled"];

/** Étapes affichées sur la page de suivi publique. */
export const TRACKING_STEPS: { status: JobStatus; label: string; at: keyof import("@/types/domain").TrackingPayload["timestamps"] }[] = [
  { status: "pending", label: msg("Demande enregistrée"), at: "created_at" },
  { status: "accepted", label: msg("Livreur en route vers le point de collecte"), at: "accepted_at" },
  { status: "picked_up", label: msg("Colis récupéré"), at: "picked_up_at" },
  { status: "in_transit", label: msg("En route vers vous"), at: "in_transit_at" },
  { status: "delivered", label: msg("Livré"), at: "delivered_at" },
];

export const PAYMENT_STATUS: Record<PaymentStatus, Meta> = {
  unpaid: { label: msg("Non payé"), tone: "warning" },
  pending: { label: msg("À confirmer"), tone: "warning" },
  paid: { label: msg("Payé"), tone: "success" },
  refunded: { label: msg("Remboursé"), tone: "muted" },
};

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  cash_on_delivery: msg("Paiement à la livraison"),
  manual: msg("Virement ou dépôt"),
  orange_money: msg("Orange Money"),
  mtn_momo: msg("MTN MoMo"),
  other: msg("Autre"),
};

export const TRANSACTION_STATUS: Record<TransactionStatus, Meta> = {
  pending: { label: msg("À confirmer"), tone: "warning" },
  confirmed: { label: msg("Confirmée"), tone: "success" },
  failed: { label: msg("Échouée"), tone: "danger" },
  refunded: { label: msg("Remboursée"), tone: "muted" },
  cancelled: { label: msg("Annulée"), tone: "muted" },
};

export const PRODUCT_STATUS: Record<ProductStatus, Meta> = {
  active: { label: msg("En vente"), tone: "success" },
  inactive: { label: msg("Masqué"), tone: "neutral" },
  archived: { label: msg("Archivé"), tone: "muted" },
};

export const COURIER_STATUS: Record<EffectiveCourierStatus, Meta & { hint: string }> = {
  available: { label: msg("Disponible"), tone: "success", hint: msg("Disponible, signal récent et capacité restante.") },
  busy: { label: msg("En livraison"), tone: "accent", hint: msg("Nombre maximal de courses actives atteint.") },
  unavailable: { label: msg("Indisponible"), tone: "neutral", hint: msg("Le livreur s'est déclaré indisponible.") },
  offline: { label: msg("Hors ligne"), tone: "muted", hint: msg("Aucun signal reçu récemment de son téléphone.") },
  inactive: { label: msg("Inactif"), tone: "muted", hint: msg("Compte non activé ou accès suspendu.") },
};

export const COURIER_ACCOUNT: Record<CourierAccountStatus, Meta> = {
  invited: { label: msg("Invitation envoyée"), tone: "neutral" },
  pending_review: { label: msg("En cours de validation"), tone: "warning" },
  active: { label: msg("Actif"), tone: "success" },
  suspended: { label: msg("Suspendu"), tone: "danger" },
  rejected: { label: msg("Refusé"), tone: "muted" },
};

export const VEHICLES: Record<string, string> = {
  moto: msg("Moto"),
  velo: msg("Vélo"),
  voiture: msg("Voiture"),
  tricycle: msg("Tricycle"),
  camionnette: msg("Camionnette"),
  pieton: msg("À pied"),
};

export const PACKAGE_TYPES: Record<string, string> = {
  document: msg("Document"),
  small: msg("Petit colis"),
  medium: msg("Colis moyen"),
  large: msg("Grand colis"),
  fragile: msg("Fragile"),
  food: msg("Repas / alimentaire"),
};

export const CLAIM_CATEGORY: Record<string, string> = {
  damaged: msg("Colis endommagé"),
  late: msg("Retard"),
  not_delivered: msg("Non livré"),
  wrong_item: msg("Mauvais article"),
  payment: msg("Paiement"),
  behaviour: msg("Comportement"),
  address: msg("Adresse introuvable"),
  unreachable: msg("Destinataire injoignable"),
  other: msg("Autre"),
};

export const CLAIM_STATUS: Record<ClaimStatus, Meta> = {
  open: { label: msg("Ouverte"), tone: "warning" },
  investigating: { label: msg("En cours"), tone: "accent" },
  resolved: { label: msg("Résolue"), tone: "success" },
  rejected: { label: msg("Rejetée"), tone: "muted" },
};

export type PlanCode = "free" | "starter" | "pro" | "business";
export type TrackingLevel = "none" | "status" | "live";

/** Noms et arguments des plans (les prix et limites viennent de la base). */
export const PLAN_META: Record<string, { name: string; tagline: string }> = {
  free: { name: msg("Gratuit"), tagline: msg("Pour démarrer : boutique en ligne et commandes.") },
  starter: { name: msg("Essentiel"), tagline: msg("Vos premiers livreurs et le suivi du colis par étapes.") },
  pro: { name: msg("Pro"), tagline: msg("Position GPS de vos livreurs en temps réel.") },
  business: { name: msg("Entreprise"), tagline: msg("Pour les équipes : plus de livreurs et d'employés.") },
};

export const TRACKING_LEVEL: Record<TrackingLevel, string> = {
  none: msg("Pas de suivi de livraison"),
  status: msg("Suivi du colis par étapes (sans position)"),
  live: msg("Position GPS du livreur en temps réel"),
};

export const SUBSCRIPTION_STATUS: Record<Enums<"subscription_status"> | "expired", Meta> = {
  pending: { label: msg("Paiement à vérifier"), tone: "warning" },
  active: { label: msg("Actif"), tone: "success" },
  expired: { label: msg("Expiré"), tone: "muted" },
  rejected: { label: msg("Refusé"), tone: "danger" },
  cancelled: { label: msg("Annulé"), tone: "muted" },
};

export function toneOf<T extends string>(map: Record<T, Meta>, key: T | null | undefined): Meta {
  if (!key || !(key in map)) return { label: key ?? "—", tone: "neutral" };
  return map[key];
}
