import { msg } from "@/i18n/msg";

/**
 * Traduction des erreurs (codes levés par les fonctions SQL, erreurs
 * PostgREST/Auth) en messages compréhensibles par l'utilisateur.
 * Les messages sont en français (clés de traduction) : l'interface les
 * affiche avec t(message) dans la langue choisie.
 */
const MESSAGES: Record<string, string> = {
  forbidden: msg("Vous n'avez pas les droits nécessaires pour cette action."),
  not_authenticated: msg("Votre session a expiré. Reconnectez-vous."),
  account_suspended: msg("Votre compte est suspendu. Contactez le support."),
  not_found: msg("Élément introuvable ou inaccessible."),
  slug_taken: msg("Cette adresse de boutique est déjà utilisée. Choisissez-en une autre."),
  invalid_store_data: msg("Certaines informations de la boutique ne sont pas valides."),
  store_limit_reached: msg("Vous avez atteint le nombre maximal de boutiques."),
  store_suspended: msg("Cette boutique est suspendue."),
  store_unavailable: msg("Cette boutique n'est pas disponible pour le moment."),
  invalid_name: msg("Le nom saisi est trop court."),
  invalid_phone: msg("Le numéro de téléphone n'est pas valide."),
  invalid_coordinates: msg("La position sur la carte n'est pas valide."),
  invalid_delivery_mode: msg("Mode de livraison invalide."),
  address_required: msg("L'adresse de livraison est obligatoire."),
  pickup_address_required: msg("Renseignez l'adresse de la boutique (point de collecte) dans les paramètres."),
  payment_method_not_accepted: msg("Ce moyen de paiement n'est pas accepté par la boutique."),
  too_many_requests: msg("Trop de demandes en peu de temps. Patientez quelques minutes."),
  order_items_required: msg("Ajoutez au moins un article."),
  too_many_items: msg("Trop d'articles dans la commande."),
  invalid_quantity: msg("Quantité invalide."),
  product_unavailable: msg("Un article n'est plus disponible."),
  variant_unavailable: msg("Une variante choisie n'est plus disponible."),
  variant_required: msg("Choisissez une variante pour cet article."),
  insufficient_stock: msg("Stock insuffisant pour un article."),
  item_name_required: msg("Chaque article libre doit avoir un nom."),
  invalid_price: msg("Prix invalide."),
  invalid_status: msg("Statut invalide."),
  customer_not_found: msg("Client introuvable."),
  order_locked: msg("Cette commande ne peut plus être modifiée."),
  invalid_transition: msg("Ce changement de statut n'est pas autorisé à cette étape."),
  job_in_progress: msg("Une livraison est en cours : le statut est mis à jour par le livreur."),
  note_required: msg("La note est vide."),
  invalid_permissions: msg("Permissions invalides."),
  invitation_invalid: msg("Cette invitation n'est plus valide (expirée, déjà utilisée ou révoquée)."),
  already_member: msg("Vous faites déjà partie de cette boutique."),
  order_is_pickup: msg("Cette commande est en retrait boutique."),
  order_closed: msg("Cette commande est clôturée."),
  job_already_exists: msg("Une livraison est déjà en cours pour cette commande."),
  job_not_assignable: msg("Cette course ne peut plus être réattribuée."),
  job_closed: msg("Cette course est déjà clôturée."),
  courier_not_active: msg("Ce livreur n'a pas encore activé son compte ou est suspendu."),
  courier_not_in_store: msg("Ce livreur ne fait pas partie de votre équipe."),
  courier_limit_reached: msg("Nombre maximal de livreurs atteint."),
  courier_already_linked: msg("Ce livreur a déjà activé son compte."),
  reason_required: msg("Indiquez un motif."),
  not_a_courier: msg("Votre compte n'est pas un compte livreur."),
  invalid_accuracy: msg("Précision GPS invalide."),
  courier_unavailable: msg("Passez en « disponible » pour accepter des courses."),
  courier_busy: msg("Vous avez déjà le nombre maximal de courses en cours."),
  invalid_proof_path: msg("Photo de preuve invalide."),
  invalid_payment_method: msg("Moyen de paiement invalide."),
  invalid_amount: msg("Montant invalide."),
  cannot_target_self: msg("Vous ne pouvez pas effectuer cette action sur votre propre compte."),
  invalid_setting_value: msg("Valeur de paramètre invalide."),
  target_required: msg("Précisez la commande ou la course concernée."),
  transaction_closed: msg("Cette transaction est clôturée."),
  invalid_range: msg("Période invalide."),
  invalid_category: msg("Catégorie invalide."),
  plan_no_couriers: msg("Votre plan actuel ne comprend pas de livreurs. Choisissez un plan payant dans Abonnement."),
  plan_courier_limit: msg("Vous avez atteint le nombre de livreurs de votre plan. Passez à un plan supérieur dans Abonnement."),
  plan_courier_limit_exceeded: msg("Vous avez plus de livreurs actifs que votre plan n'en permet. Suspendez-en ou changez de plan."),
  plan_staff_limit: msg("Vous avez atteint le nombre d'employés de votre plan. Passez à un plan supérieur dans Abonnement."),
  invalid_plan: msg("Plan invalide."),
  invalid_months: msg("Durée invalide."),
  invalid_payment_reference: msg("Indiquez la référence de la transaction (4 à 60 caractères)."),
  subscription_pending_exists: msg("Une demande d'abonnement est déjà en attente de vérification."),
  invalid_plan_value: msg("Valeurs du plan invalides."),
  // Auth
  "Invalid login credentials": msg("Adresse e-mail ou mot de passe incorrect."),
  "Email not confirmed": msg("Confirmez votre adresse e-mail avant de vous connecter (lien reçu par e-mail)."),
  "User already registered": msg("Un compte existe déjà avec cette adresse e-mail."),
};

type ErrorLike = { message?: string | null; code?: string | null; details?: string | null } | null | undefined;

export function toUserMessage(error: ErrorLike | unknown, fallback = msg("Une erreur est survenue. Réessayez.")): string {
  if (!error) return fallback;
  const e = error as { message?: string; code?: string };
  const message = (e.message ?? "").trim();
  if (message && MESSAGES[message]) return MESSAGES[message];
  if (message.startsWith("Password should")) return msg("Le mot de passe doit contenir au moins 8 caractères.");
  if (/rate limit/i.test(message)) return msg("Trop de tentatives. Réessayez dans quelques minutes.");
  if (e.code === "42501" || /permission denied/i.test(message)) return MESSAGES.forbidden;
  if (e.code === "23505") return msg("Cette valeur existe déjà.");
  if (e.code === "23514" || e.code === "22P02" || e.code === "23502") return msg("Certaines valeurs ne sont pas valides.");
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
