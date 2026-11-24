-- =====================================================================
-- Relais · 001 — Schéma principal
-- Types, tables, index et déclencheurs génériques.
-- Tous les montants sont stockés en numeric(12,2) dans la devise de la
-- boutique (XAF par défaut). Les positions GPS sont en WGS84 (degrés).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Types énumérés
-- ---------------------------------------------------------------------
create type public.store_role as enum ('owner', 'staff');
create type public.store_status as enum ('active', 'suspended');
create type public.product_status as enum ('active', 'inactive', 'archived');
create type public.order_status as enum (
  'new', 'confirmed', 'preparing', 'ready_for_pickup', 'handed_to_courier',
  'in_transit', 'delivered', 'cancelled', 'delivery_failed'
);
create type public.order_source as enum ('storefront', 'whatsapp', 'manual', 'phone', 'other');
create type public.payment_method as enum ('cash_on_delivery', 'manual', 'orange_money', 'mtn_momo', 'other');
create type public.payment_status as enum ('unpaid', 'pending', 'paid', 'refunded');
create type public.courier_kind as enum ('private', 'platform');
create type public.courier_account_status as enum ('invited', 'pending_review', 'active', 'suspended', 'rejected');
create type public.courier_availability as enum ('available', 'unavailable');
create type public.membership_status as enum ('active', 'suspended');
create type public.job_source as enum ('store_order', 'on_demand');
create type public.job_status as enum (
  'pending', 'offered', 'accepted', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled'
);
create type public.assignment_status as enum ('offered', 'accepted', 'declined', 'revoked');
create type public.transaction_status as enum ('pending', 'confirmed', 'failed', 'refunded', 'cancelled');
create type public.claim_status as enum ('open', 'investigating', 'resolved', 'rejected');
create type public.invitation_kind as enum ('staff', 'courier');

-- ---------------------------------------------------------------------
-- Fonctions utilitaires
-- ---------------------------------------------------------------------
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Code aléatoire lisible (sans 0/O, 1/I/L) pour les références.
create function public.random_code(p_len integer) returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(p_len);
  result text := '';
begin
  for i in 0 .. p_len - 1 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % 31) + 1, 1);
  end loop;
  return result;
end $$;

-- Jeton de suivi public : 24 octets aléatoires (192 bits), base64url, 32 caractères.
create function public.new_tracking_token() returns text
language sql volatile set search_path = '' as $$
  select translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_')
$$;

create function public.try_uuid(p text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

-- Distance orthodromique (à vol d'oiseau) en kilomètres.
create function public.haversine_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) returns double precision
language sql immutable set search_path = '' as $$
  select case
    when lat1 is null or lng1 is null or lat2 is null or lng2 is null then null
    else 6371.0088 * 2 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2)
      + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
    ))
  end
$$;

create function public.normalize_phone(p text) returns text
language sql immutable set search_path = '' as $$
  select nullif(regexp_replace(coalesce(p, ''), '[^0-9+]', '', 'g'), '')
$$;

-- ---------------------------------------------------------------------
-- Profils utilisateurs (1-1 avec auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text not null default '',
  phone text,
  avatar_url text,
  is_platform_admin boolean not null default false,
  is_suspended boolean not null default false,
  suspended_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_len check (char_length(full_name) <= 120)
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    public.normalize_phone(new.raw_user_meta_data ->> 'phone')
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.handle_user_email_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end $$;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------
-- Organisations et boutiques
-- ---------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);
create index organizations_owner_idx on public.organizations (owner_id);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  category text,
  phone text,
  whatsapp text,
  email text,
  address text,
  city text,
  lat double precision,
  lng double precision,
  logo_path text,
  banner_path text,
  opening_hours jsonb not null default '[]'::jsonb,
  delivery_terms text,
  default_delivery_fee numeric(12, 2) not null default 0,
  currency text not null default 'XAF',
  accepted_payment_methods public.payment_method[] not null default '{cash_on_delivery}',
  is_published boolean not null default false,
  status public.store_status not null default 'active',
  status_reason text,
  courier_max_active_jobs integer not null default 1,
  share_courier_phone boolean not null default true,
  order_seq integer not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stores_name_len check (char_length(name) between 2 and 80),
  constraint stores_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 48),
  constraint stores_fee_positive check (default_delivery_fee >= 0),
  constraint stores_max_jobs check (courier_max_active_jobs between 1 and 10),
  constraint stores_lat check (lat is null or lat between -90 and 90),
  constraint stores_lng check (lng is null or lng between -180 and 180),
  constraint stores_hours_array check (jsonb_typeof(opening_hours) = 'array'),
  constraint stores_payment_methods check (cardinality(accepted_payment_methods) >= 1)
);
create index stores_org_idx on public.stores (organization_id);
create trigger stores_updated_at before update on public.stores
  for each row execute function public.set_updated_at();

-- Permissions possibles pour le personnel (le propriétaire a tout) :
--   orders.create, orders.edit, products.view, products.manage,
--   customers.view, couriers.assign, stats.view
create table public.store_members (
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.store_role not null default 'staff',
  permissions text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (store_id, user_id),
  constraint store_members_perms check (
    permissions <@ array['orders.create', 'orders.edit', 'products.view', 'products.manage',
                         'customers.view', 'couriers.assign', 'stats.view']::text[]
  )
);
create index store_members_user_idx on public.store_members (user_id);

-- ---------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------
create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint product_categories_name_len check (char_length(name) between 1 and 60)
);
create unique index product_categories_name_uniq on public.product_categories (store_id, lower(name));

-- variants : [{ "id": "a1", "name": "Taille L", "price": 12000 | null, "available": true }]
create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  category_id uuid references public.product_categories (id) on delete set null,
  name text not null,
  description text,
  price numeric(12, 2) not null,
  promo_price numeric(12, 2),
  sku text,
  track_stock boolean not null default false,
  stock integer,
  status public.product_status not null default 'active',
  images text[] not null default '{}',
  variants jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_name_len check (char_length(name) between 1 and 120),
  constraint products_price_positive check (price >= 0),
  constraint products_promo check (promo_price is null or (promo_price >= 0 and promo_price < price)),
  constraint products_stock check (stock is null or stock >= 0),
  constraint products_images_max check (cardinality(images) <= 8),
  constraint products_variants_array check (jsonb_typeof(variants) = 'array')
);
create index products_store_status_idx on public.products (store_id, status);
create index products_category_idx on public.products (category_id);
create unique index products_sku_uniq on public.products (store_id, sku) where sku is not null;
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Clients d'une boutique
-- ---------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  full_name text not null,
  phone text not null,
  whatsapp text,
  email text,
  address text,
  lat double precision,
  lng double precision,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_name_len check (char_length(full_name) between 1 and 120),
  unique (store_id, phone)
);
create index customers_store_idx on public.customers (store_id, created_at desc);
create trigger customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Commandes
-- ---------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  number integer not null,
  reference text not null,
  customer_id uuid references public.customers (id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  source public.order_source not null default 'manual',
  status public.order_status not null default 'new',
  delivery_mode text not null default 'delivery',
  delivery_address text,
  delivery_lat double precision,
  delivery_lng double precision,
  subtotal numeric(12, 2) not null default 0,
  delivery_fee numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  currency text not null default 'XAF',
  payment_method public.payment_method not null default 'cash_on_delivery',
  payment_status public.payment_status not null default 'unpaid',
  instructions text,
  internal_note text,
  current_job_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  confirmed_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_delivery_mode check (delivery_mode in ('delivery', 'pickup')),
  constraint orders_amounts check (delivery_fee >= 0 and discount >= 0 and subtotal >= 0 and total >= 0),
  constraint orders_lat check (delivery_lat is null or delivery_lat between -90 and 90),
  constraint orders_lng check (delivery_lng is null or delivery_lng between -180 and 180),
  unique (store_id, number)
);
create index orders_store_created_idx on public.orders (store_id, created_at desc);
create index orders_store_status_idx on public.orders (store_id, status);
create index orders_customer_idx on public.orders (customer_id);
create index orders_current_job_idx on public.orders (current_job_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name text not null,
  variant_id text,
  variant_name text,
  unit_price numeric(12, 2) not null,
  quantity integer not null,
  line_total numeric(12, 2) generated always as (unit_price * quantity) stored,
  created_at timestamptz not null default now(),
  constraint order_items_qty check (quantity between 1 and 999),
  constraint order_items_price check (unit_price >= 0)
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  type text not null,
  from_status public.order_status,
  to_status public.order_status,
  message text,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);
create index order_events_store_idx on public.order_events (store_id, created_at desc);

-- ---------------------------------------------------------------------
-- Livreurs
-- ---------------------------------------------------------------------
create table public.couriers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles (id) on delete set null,
  kind public.courier_kind not null,
  full_name text not null,
  phone text not null,
  vehicle_type text,
  vehicle_plate text,
  zone text,
  zone_lat double precision,
  zone_lng double precision,
  zone_radius_km numeric(6, 2),
  account_status public.courier_account_status not null default 'invited',
  availability public.courier_availability not null default 'unavailable',
  availability_changed_at timestamptz,
  last_seen_at timestamptz,
  last_lat double precision,
  last_lng double precision,
  last_accuracy double precision,
  last_heading double precision,
  last_speed double precision,
  last_location_at timestamptz,
  id_document_path text,
  notes text,
  review_note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint couriers_name_len check (char_length(full_name) between 2 and 120),
  constraint couriers_vehicle check (vehicle_type is null or vehicle_type in ('moto', 'velo', 'voiture', 'tricycle', 'pieton', 'camionnette')),
  constraint couriers_lat check (last_lat is null or last_lat between -90 and 90),
  constraint couriers_lng check (last_lng is null or last_lng between -180 and 180)
);
create index couriers_kind_status_idx on public.couriers (kind, account_status);
create trigger couriers_updated_at before update on public.couriers
  for each row execute function public.set_updated_at();

create table public.courier_store_memberships (
  courier_id uuid not null references public.couriers (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  primary key (courier_id, store_id)
);
create index courier_store_memberships_store_idx on public.courier_store_memberships (store_id);

-- ---------------------------------------------------------------------
-- Courses (missions de livraison)
-- ---------------------------------------------------------------------
create table public.delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('LIV-' || public.random_code(6)),
  source public.job_source not null,
  store_id uuid references public.stores (id) on delete cascade,
  order_id uuid references public.orders (id) on delete cascade,
  requester_user_id uuid references public.profiles (id) on delete set null,
  requester_name text,
  requester_phone text,
  pickup_name text,
  pickup_phone text,
  pickup_address text not null,
  pickup_lat double precision,
  pickup_lng double precision,
  dropoff_name text not null,
  dropoff_phone text not null,
  dropoff_address text not null,
  dropoff_lat double precision,
  dropoff_lng double precision,
  package_type text,
  package_description text,
  instructions text,
  distance_km numeric(8, 2),
  price numeric(12, 2) not null default 0,
  collect_amount numeric(12, 2) not null default 0,
  currency text not null default 'XAF',
  payment_method public.payment_method not null default 'cash_on_delivery',
  payment_status public.payment_status not null default 'unpaid',
  payer text not null default 'sender',
  status public.job_status not null default 'pending',
  courier_id uuid references public.couriers (id) on delete set null,
  offered_at timestamptz,
  accepted_at timestamptz,
  picked_up_at timestamptz,
  in_transit_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  failure_reason text,
  cancel_reason text,
  proof_photo_path text,
  proof_note text,
  proof_recipient_name text,
  cash_collected boolean not null default false,
  recipient_confirmed_at timestamptz,
  tracking_token text not null unique default public.new_tracking_token(),
  tracking_active boolean not null default true,
  share_courier_phone boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_jobs_store_order check (source = 'on_demand' or (store_id is not null and order_id is not null)),
  constraint delivery_jobs_payer check (payer in ('sender', 'recipient', 'store')),
  constraint delivery_jobs_amounts check (price >= 0 and collect_amount >= 0),
  constraint delivery_jobs_coords check (
    (pickup_lat is null or pickup_lat between -90 and 90) and (pickup_lng is null or pickup_lng between -180 and 180)
    and (dropoff_lat is null or dropoff_lat between -90 and 90) and (dropoff_lng is null or dropoff_lng between -180 and 180)
  )
);
create index delivery_jobs_store_idx on public.delivery_jobs (store_id, created_at desc);
create index delivery_jobs_order_idx on public.delivery_jobs (order_id);
create index delivery_jobs_courier_idx on public.delivery_jobs (courier_id, status);
create index delivery_jobs_status_idx on public.delivery_jobs (status, created_at desc);
create index delivery_jobs_source_idx on public.delivery_jobs (source, created_at desc);
create index delivery_jobs_requester_idx on public.delivery_jobs (requester_user_id);
create trigger delivery_jobs_updated_at before update on public.delivery_jobs
  for each row execute function public.set_updated_at();

alter table public.orders
  add constraint orders_current_job_fk foreign key (current_job_id)
  references public.delivery_jobs (id) on delete set null;

create table public.delivery_assignments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.delivery_jobs (id) on delete cascade,
  courier_id uuid not null references public.couriers (id) on delete cascade,
  status public.assignment_status not null default 'offered',
  offered_by uuid references public.profiles (id) on delete set null,
  offered_at timestamptz not null default now(),
  responded_at timestamptz,
  note text
);
create index delivery_assignments_job_idx on public.delivery_assignments (job_id, offered_at desc);
create index delivery_assignments_courier_idx on public.delivery_assignments (courier_id, offered_at desc);

create table public.delivery_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.delivery_jobs (id) on delete cascade,
  type text not null,
  status public.job_status,
  message text,
  actor_id uuid references public.profiles (id) on delete set null,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);
create index delivery_events_job_idx on public.delivery_events (job_id, created_at);

-- Historique des positions (purgé selon la politique de rétention).
create table public.courier_locations (
  id bigint generated always as identity primary key,
  courier_id uuid not null references public.couriers (id) on delete cascade,
  job_id uuid references public.delivery_jobs (id) on delete set null,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  heading double precision,
  speed double precision,
  recorded_at timestamptz not null,
  received_at timestamptz not null default now(),
  constraint courier_locations_lat check (lat between -90 and 90),
  constraint courier_locations_lng check (lng between -180 and 180)
);
create index courier_locations_courier_idx on public.courier_locations (courier_id, received_at desc);
create index courier_locations_job_idx on public.courier_locations (job_id, received_at desc);
create index courier_locations_received_idx on public.courier_locations (received_at);

-- ---------------------------------------------------------------------
-- Tarification des livraisons ponctuelles
-- ---------------------------------------------------------------------
create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default false,
  base_fee numeric(12, 2) not null default 0,
  per_km_fee numeric(12, 2) not null default 0,
  min_fee numeric(12, 2) not null default 0,
  max_distance_km numeric(8, 2),
  rounding integer not null default 100,
  package_surcharges jsonb not null default '{}'::jsonb,
  currency text not null default 'XAF',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pricing_rules_amounts check (base_fee >= 0 and per_km_fee >= 0 and min_fee >= 0),
  constraint pricing_rules_rounding check (rounding between 1 and 10000),
  constraint pricing_rules_surcharges check (jsonb_typeof(package_surcharges) = 'object')
);
create unique index pricing_rules_one_active on public.pricing_rules ((true)) where is_active;
create trigger pricing_rules_updated_at before update on public.pricing_rules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Paiements (enregistrement manuel ; aucun prestataire n'est simulé)
-- ---------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores (id) on delete cascade,
  order_id uuid references public.orders (id) on delete cascade,
  job_id uuid references public.delivery_jobs (id) on delete cascade,
  amount numeric(12, 2) not null,
  currency text not null default 'XAF',
  method public.payment_method not null,
  provider text not null default 'manual',
  provider_reference text,
  status public.transaction_status not null default 'pending',
  notes text,
  recorded_by uuid references public.profiles (id) on delete set null,
  confirmed_by uuid references public.profiles (id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint transactions_amount check (amount > 0),
  constraint transactions_target check (order_id is not null or job_id is not null)
);
create index transactions_store_idx on public.transactions (store_id, created_at desc);
create index transactions_order_idx on public.transactions (order_id);
create index transactions_job_idx on public.transactions (job_id);
create index transactions_status_idx on public.transactions (status, created_at desc);

-- ---------------------------------------------------------------------
-- Réclamations et incidents
-- ---------------------------------------------------------------------
create table public.claims (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('REC-' || public.random_code(6)),
  job_id uuid references public.delivery_jobs (id) on delete set null,
  order_id uuid references public.orders (id) on delete set null,
  store_id uuid references public.stores (id) on delete cascade,
  reporter_type text not null,
  reporter_user_id uuid references public.profiles (id) on delete set null,
  reporter_name text,
  reporter_phone text,
  category text not null,
  description text not null,
  status public.claim_status not null default 'open',
  resolution text,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint claims_reporter_type check (reporter_type in ('customer', 'courier', 'store', 'admin')),
  constraint claims_category check (category in ('damaged', 'late', 'not_delivered', 'wrong_item', 'payment', 'behaviour', 'address', 'unreachable', 'other')),
  constraint claims_description_len check (char_length(description) between 5 and 2000)
);
create index claims_store_idx on public.claims (store_id, created_at desc);
create index claims_job_idx on public.claims (job_id);
create index claims_status_idx on public.claims (status, created_at desc);
create trigger claims_updated_at before update on public.claims
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Paramètres de la plateforme
-- ---------------------------------------------------------------------
create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
create trigger platform_settings_updated_at before update on public.platform_settings
  for each row execute function public.set_updated_at();

insert into public.platform_settings (key, value, description) values
  ('location.active_interval_s', '10', 'Intervalle d''envoi de la position pendant une course active (secondes).'),
  ('location.idle_interval_s', '60', 'Intervalle d''envoi de la position lorsque le livreur est disponible sans course (secondes).'),
  ('location.stale_after_s', '120', 'Au-delà de ce délai sans mise à jour, la position est affichée comme obsolète (secondes).'),
  ('courier.offline_after_s', '180', 'Au-delà de ce délai sans signal, le livreur est considéré hors ligne (secondes).'),
  ('courier.auto_unavailable_after_s', '3600', 'Un livreur « disponible » sans signal depuis ce délai repasse automatiquement indisponible (secondes).'),
  ('tracking.retention_days', '30', 'Durée de conservation de l''historique des positions GPS (jours).'),
  ('dispatch.platform_max_active_jobs', '1', 'Nombre maximal de courses actives simultanées pour un livreur du réseau.'),
  ('dispatch.open_pool_radius_km', '15', 'Rayon dans lequel les livreurs du réseau voient les courses ponctuelles en attente (km).'),
  ('on_demand.enabled', 'true', 'Active ou désactive les demandes de livraison ponctuelle.');

-- ---------------------------------------------------------------------
-- Invitations (personnel et livreurs privés)
-- ---------------------------------------------------------------------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  kind public.invitation_kind not null,
  store_id uuid not null references public.stores (id) on delete cascade,
  courier_id uuid references public.couriers (id) on delete cascade,
  permissions text[] not null default '{}',
  label text,
  token_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint invitations_courier check (kind = 'staff' or courier_id is not null)
);
create index invitations_store_idx on public.invitations (store_id, created_at desc);

-- ---------------------------------------------------------------------
-- Journal d'activité
-- ---------------------------------------------------------------------
create table public.activity_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  store_id uuid references public.stores (id) on delete cascade,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_logs_created_idx on public.activity_logs (created_at desc);
create index activity_logs_store_idx on public.activity_logs (store_id, created_at desc);
create index activity_logs_actor_idx on public.activity_logs (actor_id);

-- ---------------------------------------------------------------------
-- RLS activée partout (les politiques sont dans la migration suivante)
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.couriers enable row level security;
alter table public.courier_store_memberships enable row level security;
alter table public.delivery_jobs enable row level security;
alter table public.delivery_assignments enable row level security;
alter table public.delivery_events enable row level security;
alter table public.courier_locations enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.transactions enable row level security;
alter table public.claims enable row level security;
alter table public.platform_settings enable row level security;
alter table public.invitations enable row level security;
alter table public.activity_logs enable row level security;
