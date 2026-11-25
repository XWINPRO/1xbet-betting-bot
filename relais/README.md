# Relais — commerce et livraison en temps réel

Plateforme SaaS pour les boutiques et la livraison au Cameroun et en Afrique francophone :
boutique en ligne, commandes WhatsApp, livreurs privés, réseau de livreurs indépendants,
livraisons ponctuelles et suivi GPS réel partageable.

- **Boutiques** : catalogue, page publique, commandes (boutique, WhatsApp, téléphone), clients,
  livreurs privés, attribution avec suggestion, suivi en direct, statistiques, équipe.
- **Livraison ponctuelle** : `/delivery`, sans compte, prix affiché avant confirmation, lien de suivi.
- **Livreurs** : application mobile dans le navigateur (`/courier`), disponibilité, missions,
  navigation Google Maps/Waze, GPS, preuve photo, encaissement, historique.
- **Administration** : `/admin` — vue globale, comptes, validation des livreurs, attribution
  manuelle, paiements, tarification, réclamations, paramètres, journal d'activité.

---

## Sommaire

1. [Stack technique](#stack-technique)
2. [Démarrage local](#démarrage-local)
3. [Configuration Supabase à faire](#configuration-supabase-à-faire)
4. [Déploiement (Vercel)](#déploiement-vercel)
5. [Architecture du code](#architecture-du-code)
6. [Base de données](#base-de-données)
7. [Rôles et sécurité](#rôles-et-sécurité)
8. [Suivi GPS et temps réel](#suivi-gps-et-temps-réel)
9. [WhatsApp](#whatsapp)
10. [Paiements](#paiements)
11. [Cartographie](#cartographie)
12. [Limites connues et suites](#limites-connues-et-suites)

---

## Stack technique

| Domaine | Choix |
| --- | --- |
| Application | Next.js 16 (App Router, Server Components, Server Actions), TypeScript strict |
| Interface | Tailwind CSS 4, primitives accessibles Radix UI, icônes Lucide, police Geist |
| Données | Supabase : PostgreSQL, Auth, Realtime, Storage, pg_cron |
| Validation | Zod (client et serveur) + contrôles en base (contraintes, fonctions RPC) |
| Cartes | Leaflet + OpenStreetMap ; géocodage et routage optionnels (Nominatim / OSRM) |

`cacheComponents` est volontairement désactivé : toutes les pages dépendent de la session et
des droits RLS de l'utilisateur, le rendu dynamique par requête est le modèle adapté.

## Démarrage local

Prérequis : Node.js 20.9 ou plus récent.

```bash
cd relais
cp .env.example .env.local     # puis renseignez les valeurs
npm install
npm run dev                    # http://localhost:3000
```

Variables obligatoires (`.env.local`) :

| Variable | Rôle |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publique (`sb_publishable_…`). Elle n'ouvre que ce que la RLS autorise. |
| `NEXT_PUBLIC_SITE_URL` | URL publique du site (liens de suivi, d'invitation, e-mails) |

Les autres variables (carte, géocodage, routage, WhatsApp Business) sont documentées dans
`.env.example`. **Aucune clé secrète n'est nécessaire** : l'application n'utilise jamais la clé
`service_role`.

Vérifications :

```bash
npx tsc --noEmit     # typage
npm run build        # build de production
```

## Configuration Supabase à faire

Le projet `relais-livraison` (région Paris) contient déjà toutes les migrations. Il reste à régler
dans le tableau de bord Supabase :

1. **Authentication → URL Configuration**
   - *Site URL* : l'URL de production (ex. `https://votre-domaine.com`).
   - *Redirect URLs* : ajoutez `https://votre-domaine.com/auth/callback` et `http://localhost:3000/auth/callback`.
2. **Authentication → Emails** : le service d'e-mail intégré de Supabase est limité (quelques
   messages par heure, destinataires restreints). Pour la production, configurez un SMTP
   (Brevo, Resend, Mailgun…). Les identifiants SMTP sont à saisir par vous dans Supabase.
   Si la confirmation d'e-mail est désactivée, l'inscription ouvre directement la session.
3. **Premier administrateur** : créez votre compte via `/signup`, puis exécutez dans le SQL Editor :

   ```sql
   update public.profiles set is_platform_admin = true where email = 'votre@email.com';
   ```

   Les administrateurs suivants se nomment depuis `/admin/users`.
4. **Tarification** : une grille de départ (500 FCFA + 150 FCFA/km, minimum 1 000 FCFA) est
   active pour que `/delivery` fonctionne. **Ajustez-la** dans `/admin/pricing`.

## Déploiement (Vercel)

1. Importez le dépôt dans Vercel et définissez **Root Directory = `relais`**.
2. Ajoutez les variables d'environnement (au minimum les trois obligatoires ci-dessus).
3. Mettez à jour la *Site URL* et les *Redirect URLs* Supabase avec le domaine Vercel.

## Architecture du code

```
relais/
├── supabase/migrations/      Schéma, RLS, fonctions métier (source de vérité de la base)
└── src/
    ├── app/
    │   ├── (auth)/           Connexion, inscription, mot de passe
    │   ├── auth/             Retours des liens e-mail (PKCE, token_hash)
    │   ├── onboarding/       Création de boutique
    │   ├── dashboard/        Espace boutique (commandes, produits, clients, livraisons…)
    │   ├── courier/          Application livreur (mobile) + candidature réseau
    │   ├── admin/            Administration de la plateforme
    │   ├── shop/[slug]/      Boutique publique (catalogue, panier, commande)
    │   ├── delivery/         Livraison ponctuelle
    │   ├── track/[token]/    Suivi public
    │   ├── invite/[token]/   Invitations (employés, livreurs)
    │   └── api/              Proxys géocodage et itinéraire (limités en débit)
    ├── components/           ui/ (système de design), map/, courier/, delivery/, …
    ├── lib/
    │   ├── actions/          Server Actions par domaine (validation Zod puis RPC)
    │   ├── supabase/         Clients navigateur / serveur / proxy de session
    │   ├── validation/       Schémas Zod
    │   ├── dispatch.ts       Suggestion de livreur (règles, pas d'IA)
    │   ├── whatsapp.ts       Liens wa.me et modèles de messages
    │   ├── messaging/        Canal WhatsApp Business API (inactif sans configuration)
    │   ├── payments/         Moyens de paiement et interface des futures passerelles
    │   └── maps/             Géocodage et routage (serveur)
    ├── proxy.ts              Rafraîchissement de session et protection des espaces privés
    └── types/                Types générés de la base + types métier
```

Principes : lectures en Server Components avec le client Supabase de l'utilisateur (RLS) ;
écritures sensibles via des fonctions SQL `SECURITY DEFINER` qui vérifient les droits ;
messages d'erreur métier traduits dans `lib/errors.ts`.

## Base de données

Migrations dans `supabase/migrations/` (appliquées dans cet ordre) :

| Fichier | Contenu |
| --- | --- |
| `…100_schema.sql` | 22 tables, types, index, RLS activée partout |
| `…200_access_and_triggers.sql` | Fonctions d'accès, déclencheurs (numérotation, totaux, historique, synchronisation commande/course), politiques RLS, privilèges par colonne |
| `…300_rpc_commerce.sql` | Boutiques, commandes (stock, prix serveur), équipe et invitations |
| `…400_rpc_delivery.sql` | Courses, attribution, livreurs, GPS, suivi public, livraisons ponctuelles |
| `…500_admin_stats_platform.sql` | Administration, paiements, statistiques, stockage, Realtime, tâches pg_cron, droits d'exécution |
| `…600_fix_store_visibility.sql` | Correctif : lecture publique des boutiques |
| `…700_default_pricing.sql` | Grille tarifaire de départ |

Tables principales : `profiles`, `organizations`, `stores`, `store_members`, `products`,
`product_categories`, `customers`, `orders`, `order_items`, `order_events`, `couriers`,
`courier_store_memberships`, `courier_locations`, `delivery_jobs`, `delivery_assignments`,
`delivery_events`, `pricing_rules`, `transactions`, `claims`, `invitations`,
`platform_settings`, `activity_logs`.

Régénérer les types après une modification du schéma :

```bash
npx supabase gen types typescript --project-id hyclnyozjhjiggufztmo > src/types/database.ts
```

## Rôles et sécurité

| Rôle | Accès |
| --- | --- |
| Administrateur plateforme | `/admin`, lecture de toutes les données, modération, tarification, paramètres |
| Propriétaire de boutique | Toute sa boutique, ses livreurs, son équipe, sa page publique |
| Employé | Commandes en lecture + permissions cochées par le propriétaire (créer/modifier des commandes, catalogue, clients, attribution, chiffre d'affaires). Jamais les paramètres, la boutique en ligne ni la gestion des livreurs. |
| Livreur privé | Uniquement les courses qui lui sont attribuées et les informations nécessaires |
| Livreur réseau | Ses courses + courses ponctuelles en attente (sans téléphones avant acceptation) |
| Client / visiteur | Boutique publique, livraison ponctuelle, suivi par jeton |

Mesures en place :

- **RLS sur toutes les tables**, privilèges minimaux (`revoke all`, puis `grant` explicites et
  privilèges par colonne : un utilisateur ne peut pas se donner le rôle admin).
- **Fonctions RPC** `SECURITY DEFINER` avec `search_path` vide, contrôle des droits à l'entrée,
  `EXECUTE` révoqué par défaut puis accordé fonction par fonction.
- **Prix, frais, stock et totaux recalculés côté serveur** (une commande publique ne peut pas
  fixer son prix) ; limitation anti-abus sur les commandes et demandes anonymes.
- **Jetons de suivi** de 192 bits ; **jetons d'invitation** stockés hachés (SHA-256), valables 7 jours.
- **Page de suivi** : données minimales (prénom du livreur, aucun numéro du destinataire), position
  visible uniquement pendant la course, numéro du livreur masqué après la livraison.
- **Stockage** : photos produits publiques par boutique ; preuves de livraison et pièces d'identité
  privées, accessibles par URL signée de courte durée.
- En-têtes de sécurité (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`) ;
  `noindex` sur le suivi et les invitations ; redirections internes uniquement après connexion.
- Suspension des comptes et des boutiques appliquée en base (fonctions d'accès).

Isolation vérifiée en base : un propriétaire ne voit ni les commandes ni les clients d'une autre
boutique, ne peut ni modifier ni changer le statut de ses commandes, et un visiteur anonyme ne lit
aucune commande.

## Suivi GPS et temps réel

- Le livreur **autorise lui-même** la localisation (geste explicite « Passer disponible » ou
  « Activer »). Un bandeau permanent indique si la position est partagée, avec quelle précision et
  quand elle a été envoyée.
- Partage **uniquement** pendant une course active ou lorsque le livreur s'est déclaré disponible.
  En repassant indisponible hors course, la dernière position est effacée du profil.
- Fréquence configurable (`/admin/settings`) : 10 s en course, 60 s en attente par défaut ; si le
  téléphone ne produit pas de nouvelle mesure, une mesure fraîche est demandée — jamais l'ancienne
  renvoyée comme nouvelle. Aucune position n'est inventée ni interpolée.
- Positions **obsolètes** signalées au-delà de 120 s (configurable), avec l'heure de la dernière mesure.
- **Limite des navigateurs mobiles** : en arrière-plan ou écran verrouillé, le GPS peut être
  suspendu. L'application le dit au livreur et propose de garder l'écran allumé (Wake Lock).
- Disponibilité réelle calculée en base : *disponible* (déclaré + signal récent + capacité),
  *en livraison* (limite de courses atteinte), *indisponible*, *hors ligne* (aucun signal récent).
  Une tâche planifiée repasse en indisponible un livreur silencieux depuis 1 h.
- **Rétention** : historique GPS supprimé après 30 jours (configurable) par pg_cron ; suivi en
  direct coupé automatiquement à la fin de la course.
- **Temps réel** : tableaux de bord via Supabase Realtime (filtré par RLS) ; la page publique de
  suivi reçoit un signal « changement » puis relit l'état officiel — un message forgé ne peut donc
  pas afficher une fausse position. Relecture périodique de secours si le réseau mobile coupe le
  canal temps réel.

## WhatsApp

Version 1 : liens `wa.me` avec messages préremplis (confirmation de commande, lien de suivi,
mission du livreur, contact du destinataire, partage de produit et de boutique, envoi du panier,
invitations). L'utilisateur envoie lui-même le message : **aucune synchronisation automatique
n'est simulée**.

L'intégration WhatsApp Business (Cloud API) est préparée dans `src/lib/messaging/` : elle ne
s'active que si `WHATSAPP_CLOUD_API_TOKEN` et `WHATSAPP_PHONE_NUMBER_ID` sont définis et que les
modèles de messages sont approuvés par Meta.

## Paiements

Disponible : paiement à la livraison (le livreur déclare l'encaissement, la boutique confirme la
remise), Orange Money / MTN MoMo / virement **confirmés manuellement**, historique des
transactions, état payé/non payé recalculé à partir des transactions confirmées.

Aucun prestataire n'est connecté et **aucune transaction n'est simulée**. Pour brancher un
prestataire Mobile Money, implémenter l'interface `PaymentGateway` de `src/lib/payments/` (les clés
API seront à fournir par vous).

## Cartographie

- Fond de carte OpenStreetMap (`NEXT_PUBLIC_MAP_TILE_URL`). Le serveur de tuiles public d'OSM est
  réservé à un usage modéré : en production, utilisez un fournisseur de tuiles.
- Recherche d'adresse : activée seulement si `GEOCODING_URL` est défini (Nominatim ou compatible ;
  respectez sa politique : identification via `GEOCODING_CONTACT`, pas d'autocomplétion).
- Itinéraire et heure d'arrivée : affichés **uniquement** si `ROUTING_URL` (OSRM ou compatible)
  est défini. Sans service de routage, la carte montre les points sans tracer de trajet inventé.
- Les distances de tarification et de suggestion sont **à vol d'oiseau**, et indiquées comme telles.

## Limites connues et suites

- Notifications push (Web Push) non implémentées : le livreur est prévenu par l'application ouverte
  (temps réel + vibration) et par le lien WhatsApp envoyé par la boutique.
- Dispatch automatique des livreurs du réseau : non implémenté ; les courses ponctuelles sont
  visibles par les livreurs disponibles à proximité (premier qui accepte) et attribuables par l'admin.
- Les comptes et données de test utilisés pendant le développement ont été supprimés ; la base est vide.
