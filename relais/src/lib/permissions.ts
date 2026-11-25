import { msg } from "@/i18n/msg";

export const STAFF_PERMISSIONS = [
  { key: "orders.create", label: msg("Créer des commandes"), hint: msg("Saisir les commandes reçues par WhatsApp ou téléphone.") },
  { key: "orders.edit", label: msg("Modifier les commandes"), hint: msg("Changer les statuts, les montants et enregistrer les paiements.") },
  { key: "products.view", label: msg("Consulter les produits"), hint: msg("Lecture seule du catalogue.") },
  { key: "products.manage", label: msg("Gérer le catalogue"), hint: msg("Ajouter, modifier et supprimer des produits.") },
  { key: "customers.view", label: msg("Consulter les clients"), hint: msg("Accès au fichier clients.") },
  { key: "couriers.assign", label: msg("Attribuer les livreurs"), hint: msg("Créer des courses et choisir le livreur.") },
  { key: "stats.view", label: msg("Voir le chiffre d'affaires"), hint: msg("Accès aux montants et aux statistiques.") },
] as const;

export type StaffPermission = (typeof STAFF_PERMISSIONS)[number]["key"];

export const PERMISSION_LABEL: Record<string, string> = Object.fromEntries(
  STAFF_PERMISSIONS.map((p) => [p.key, p.label]),
);
