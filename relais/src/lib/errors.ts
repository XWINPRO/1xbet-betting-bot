/**
 * Traduction des erreurs (codes levés par les fonctions SQL, erreurs
 * PostgREST/Auth) en messages compréhensibles par l'utilisateur.
 */
const MESSAGES: Record<string, string> = {
  forbidden: "Vous n'avez pas les droits nécessaires pour cette action.",
  not_authenticated: "Votre session a expiré. Reconnectez-vous.",
  account_suspended: "Votre compte est suspendu. Contactez le support.",
  not_found: "Élément introuvable ou inaccessible.",
  slug_taken: "Cette adresse de boutique est déjà utilisée. Choisissez-en une autre.",
  invalid_store_data: "Certaines informations de la boutique ne sont pas valides.",
  store_limit_reached: "Vous avez atteint le nombre maximal de boutiques.",
  store_suspended: "Cette boutique est suspendue.",
  store_unavailable: "Cette boutique n'est pas disponible pour le moment.",
  invalid_name: "Le nom saisi est trop court.",
  invalid_phone: "Le numéro de téléphone n'est pas valide.",
  invalid_coordinates: "La position sur la carte n'est pas valide.",
  invalid_delivery_mode: "Mode de livraison invalide.",
  address_required: "L'adresse de livraison est obligatoire.",
  pickup_address_required: "Renseignez l'adresse de la boutique (point de collecte) dans les paramètres.",
  payment_method_not_accepted: "Ce moyen de paiement n'est pas accepté par la boutique.",
  too_many_requests: "Trop de demandes en peu de temps. Patientez quelques minutes.",
  order_items_required: "Ajoutez au moins un article.",
  too_many_items: "Trop d'articles dans la commande.",
  invalid_quantity: "Quantité invalide.",
  product_unavailable: "Un article n'est plus disponible.",
  variant_unavailable: "Une variante choisie n'est plus disponible.",
  variant_required: "Choisissez une variante pour cet article.",
  insufficient_stock: "Stock insuffisant pour un article.",
  item_name_required: "Chaque article libre doit avoir un nom.",
  invalid_price: "Prix invalide.",
  invalid_status: "Statut invalide.",
  customer_not_found: "Client introuvable.",
  order_locked: "Cette commande ne peut plus être modifiée.",
  invalid_transition: "Ce changement de statut n'est pas autorisé à cette étape.",
  job_in_progress: "Une livraison est en cours : le statut est mis à jour par le livreur.",
  note_required: "La note est vide.",
  invalid_permissions: "Permissions invalides.",
  invitation_invalid: "Cette invitation n'est plus valide (expirée, déjà utilisée ou révoquée).",
  already_member: "Vous faites déjà partie de cette boutique.",
  order_is_pickup: "Cette commande est en retrait boutique.",
  order_closed: "Cette commande est clôturée.",
  job_already_exists: "Une livraison est déjà en cours pour cette commande.",
  job_not_assignable: "Cette course ne peut plus être réattribuée.",
  job_closed: "Cette course est déjà clôturée.",
  courier_not_active: "Ce livreur n'a pas encore activé son compte ou est suspendu.",
  courier_not_in_store: "Ce livreur ne fait pas partie de votre équipe.",
  courier_not_platform: "Seuls les livreurs du réseau peuvent recevoir cette course.",
  courier_limit_reached: "Nombre maximal de livreurs atteint.",
  courier_already_linked: "Ce livreur a déjà activé son compte.",
  reason_required: "Indiquez un motif.",
  not_a_courier: "Votre compte n'est pas un compte livreur.",
  invalid_accuracy: "Précision GPS invalide.",
  offer_not_found: "Cette proposition n'est plus disponible.",
  courier_unavailable: "Passez en « disponible » pour accepter des courses.",
  courier_busy: "Vous avez déjà le nombre maximal de courses en cours.",
  job_taken: "Cette course vient d'être prise par un autre livreur.",
  invalid_proof_path: "Photo de preuve invalide.",
  already_courier: "Votre compte est déjà enregistré comme livreur.",
  invalid_document_path: "Document invalide.",
  on_demand_disabled: "Les livraisons ponctuelles sont momentanément désactivées.",
  pricing_unavailable: "La tarification n'est pas encore configurée.",
  distance_too_long: "Distance trop importante pour ce service.",
  invalid_package_type: "Type de colis invalide.",
  invalid_payment_method: "Moyen de paiement invalide.",
  invalid_payer: "Payeur invalide.",
  invalid_amount: "Montant invalide.",
  price_changed: "Le tarif a été mis à jour. Vérifiez le nouveau prix avant de confirmer.",
  invalid_decision: "Décision invalide.",
  cannot_target_self: "Vous ne pouvez pas effectuer cette action sur votre propre compte.",
  invalid_setting_value: "Valeur de paramètre invalide.",
  target_required: "Précisez la commande ou la course concernée.",
  transaction_closed: "Cette transaction est clôturée.",
  invalid_range: "Période invalide.",
  invalid_category: "Catégorie invalide.",
  // Auth
  "Invalid login credentials": "Adresse e-mail ou mot de passe incorrect.",
  "Email not confirmed": "Confirmez votre adresse e-mail avant de vous connecter (lien reçu par e-mail).",
  "User already registered": "Un compte existe déjà avec cette adresse e-mail.",
};

type ErrorLike = { message?: string | null; code?: string | null; details?: string | null } | null | undefined;

export function toUserMessage(error: ErrorLike | unknown, fallback = "Une erreur est survenue. Réessayez."): string {
  if (!error) return fallback;
  const e = error as { message?: string; code?: string };
  const message = (e.message ?? "").trim();
  if (message && MESSAGES[message]) return MESSAGES[message];
  if (message.startsWith("Password should")) return "Le mot de passe doit contenir au moins 8 caractères.";
  if (/rate limit/i.test(message)) return "Trop de tentatives. Réessayez dans quelques minutes.";
  if (e.code === "42501" || /permission denied/i.test(message)) return MESSAGES.forbidden;
  if (e.code === "23505") return "Cette valeur existe déjà.";
  if (e.code === "23514" || e.code === "22P02" || e.code === "23502") return "Certaines valeurs ne sont pas valides.";
  if (e.code === "PGRST116") return MESSAGES.not_found;
  return fallback;
}

export type ActionResult<T = null> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/** Convertit les erreurs Zod en { champ: message }. */
export function zodFieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
