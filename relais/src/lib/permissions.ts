export const STAFF_PERMISSIONS = [
  { key: "orders.create", label: "Créer des commandes", hint: "Saisir les commandes reçues par WhatsApp ou téléphone." },
  { key: "orders.edit", label: "Modifier les commandes", hint: "Changer les statuts, les montants et enregistrer les paiements." },
  { key: "products.view", label: "Consulter les produits", hint: "Lecture seule du catalogue." },
  { key: "products.manage", label: "Gérer le catalogue", hint: "Ajouter, modifier et supprimer des produits." },
  { key: "customers.view", label: "Consulter les clients", hint: "Accès au fichier clients." },
  { key: "couriers.assign", label: "Attribuer les livreurs", hint: "Créer des courses et choisir le livreur." },
  { key: "stats.view", label: "Voir le chiffre d'affaires", hint: "Accès aux montants et aux statistiques." },
] as const;

export type StaffPermission = (typeof STAFF_PERMISSIONS)[number]["key"];

export const PERMISSION_LABEL: Record<string, string> = Object.fromEntries(
  STAFF_PERMISSIONS.map((p) => [p.key, p.label]),
);
