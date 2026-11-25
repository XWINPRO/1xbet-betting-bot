-- =====================================================================
-- Relais · 008 — Abonnements des commerçants et limites par plan.
--
-- * La plateforme ne fournit plus de livreurs : seuls les commerçants
--   créent un compte, puis parrainent leurs propres livreurs.
--   Les livraisons ponctuelles et les livreurs « du réseau » sont retirés.
-- * Chaque boutique est sur un plan (gratuit par défaut). Un plan payant
--   est activé par l'administrateur après vérification du paiement
--   mobile money déclaré par le commerçant (aucun paiement simulé).
-- * Le plan fixe : nombre de livreurs, nombre d'employés, niveau de suivi
--   (aucun / par étapes / position GPS en direct). Ces limites sont
--   vérifiées côté base de données.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Retrait des livraisons ponctuelles et des livreurs du réseau
-- ---------------------------------------------------------------------
drop function if exists public.apply_platform_courier(jsonb);
drop function if exists public.admin_review_courier(uuid, text, text);
drop function if exists public.courier_open_jobs();
drop function if exists public.courier_claim_job(uuid);
drop function if exists public.quote_delivery(double precision, double precision, double precision, double precision, text);
drop function if exists public.create_on_demand_delivery(jsonb);
drop function if exists public.cancel_on_demand_by_token(text);
drop function if exists public.admin_courier_board(public.courier_kind);
drop table if exists public.pricing_rules;

delete from public.platform_settings
where key in ('dispatch.platform_max_active_jobs', 'dispatch.open_pool_radius_km', 'on_demand.enabled');

alter table public.couriers add constraint couriers_private_only check (kind = 'private') not valid;
alter table public.couriers validate constraint couriers_private_only;
alter table public.delivery_jobs add constraint delivery_jobs_store_only check (source = 'store_order') not valid;
alter table public.delivery_jobs validate constraint delivery_jobs_store_only;

-- ---------------------------------------------------------------------
-- 2. Plans et abonnements
-- ---------------------------------------------------------------------
create type public.tracking_level as enum ('none', 'status', 'live');
create type public.subscription_status as enum ('pending', 'active', 'rejected', 'cancelled');

create table public.plans (
  code text primary key,
  price_monthly numeric(12, 2) not null default 0,
  currency text not null default 'XAF',
  max_couriers integer not null default 0,
  max_staff integer not null default 0,
  tracking public.tracking_level not null default 'none',
  is_public boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  constraint plans_code check (code ~ '^[a-z_]{2,30}$'),
  constraint plans_price check (price_monthly >= 0 and price_monthly <= 10000000),
  constraint plans_limits check (max_couriers between 0 and 500 and max_staff between 0 and 200)
);
create trigger plans_updated_at before update on public.plans
  for each row execute function public.set_updated_at();

insert into public.plans (code, price_monthly, max_couriers, max_staff, tracking, sort_order) values
  ('free', 0, 0, 0, 'none', 0),
  ('starter', 2500, 2, 1, 'status', 1),
  ('pro', 7500, 7, 3, 'live', 2),
  ('business', 25000, 10, 10, 'live', 3);

create table public.store_subscriptions (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('ABO-' || public.random_code(6)),
  store_id uuid not null references public.stores (id) on delete cascade,
  plan_code text not null references public.plans (code),
  months integer not null,
  amount numeric(12, 2) not null default 0,
  currency text not null default 'XAF',
  status public.subscription_status not null default 'pending',
  payment_method public.payment_method,
  payer_phone text,
  payment_reference text,
  note text,
  admin_note text,
  starts_at timestamptz,
  ends_at timestamptz,
  requested_by uuid references public.profiles (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_subscriptions_months check (months in (1, 3, 6, 12)),
  constraint store_subscriptions_amount check (amount >= 0),
  constraint store_subscriptions_period check (status <> 'active' or (starts_at is not null and ends_at > starts_at))
);
create index store_subscriptions_store_idx on public.store_subscriptions (store_id, created_at desc);
create index store_subscriptions_status_idx on public.store_subscriptions (status, created_at desc);
create unique index store_subscriptions_one_pending on public.store_subscriptions (store_id) where status = 'pending';
create trigger store_subscriptions_updated_at before update on public.store_subscriptions
  for each row execute function public.set_updated_at();

insert into public.platform_settings (key, value, description) values
  ('billing.payee_name', '""', 'Nom du bénéficiaire des paiements d''abonnement affiché aux commerçants.'),
  ('billing.orange_money_number', '""', 'Numéro Orange Money qui reçoit les paiements d''abonnement.'),
  ('billing.mtn_momo_number', '""', 'Numéro MTN Mobile Money qui reçoit les paiements d''abonnement.')
on conflict (key) do nothing;

-- Plan en vigueur : l'abonnement actif le plus élevé, sinon « free ».
create function public.store_plan_code(p_store_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select s.plan_code
    from public.store_subscriptions s
    join public.plans p on p.code = s.plan_code
    where s.store_id = p_store_id and s.status = 'active'
      and s.starts_at <= now() and s.ends_at > now()
    order by p.sort_order desc
    limit 1
  ), 'free');
$$;

create function public.store_plan(p_store_id uuid) returns public.plans
language sql stable security definer set search_path = '' as $$
  select p.* from public.plans p where p.code = public.store_plan_code(p_store_id);
$$;

create function public.store_courier_count(p_store_id uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.courier_store_memberships
  where store_id = p_store_id and status = 'active';
$$;

create function public.store_staff_count(p_store_id uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select (
    (select count(*) from public.store_members where store_id = p_store_id and role = 'staff')
    + (select count(*) from public.invitations
       where store_id = p_store_id and kind = 'staff'
         and accepted_at is null and revoked_at is null and expires_at > now())
  )::integer;
$$;

-- Résumé du plan pour l'interface (membres de la boutique).
create function public.store_plan_info(p_store_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_plan public.plans;
  v_ends timestamptz;
begin
  if not (public.is_store_member(p_store_id) or public.is_platform_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_plan := public.store_plan(p_store_id);
  select max(ends_at) into v_ends from public.store_subscriptions
  where store_id = p_store_id and plan_code = v_plan.code and status = 'active' and ends_at > now();
  return jsonb_build_object(
    'code', v_plan.code,
    'tracking', v_plan.tracking,
    'max_couriers', v_plan.max_couriers,
    'max_staff', v_plan.max_staff,
    'couriers_used', public.store_courier_count(p_store_id),
    'staff_used', public.store_staff_count(p_store_id),
    'ends_at', v_ends,
    'pending', exists (select 1 from public.store_subscriptions where store_id = p_store_id and status = 'pending')
  );
end $$;

-- Coordonnées de paiement publiées par l'administrateur.
create function public.billing_payment_details() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'payee_name', (select value #>> '{}' from public.platform_settings where key = 'billing.payee_name'),
    'orange_money', (select value #>> '{}' from public.platform_settings where key = 'billing.orange_money_number'),
    'mtn_momo', (select value #>> '{}' from public.platform_settings where key = 'billing.mtn_momo_number')
  );
$$;

-- Le commerçant déclare un paiement mobile money pour un plan.
create function public.request_subscription(
  p_store_id uuid, p_plan_code text, p_months integer, p_method public.payment_method,
  p_payer_phone text, p_payment_reference text, p_note text default null
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_plan public.plans%rowtype;
  v_phone text := public.normalize_phone(p_payer_phone);
  v_ref text := trim(coalesce(p_payment_reference, ''));
  v_out text;
begin
  if not public.is_store_owner(p_store_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_plan from public.plans where code = p_plan_code and is_public;
  if not found or v_plan.price_monthly <= 0 then raise exception 'invalid_plan'; end if;
  if p_months not in (1, 3, 6, 12) then raise exception 'invalid_months'; end if;
  if p_method not in ('orange_money', 'mtn_momo') then raise exception 'invalid_payment_method'; end if;
  if not public.is_valid_phone(v_phone) then raise exception 'invalid_phone'; end if;
  if char_length(v_ref) < 4 or char_length(v_ref) > 60 then raise exception 'invalid_payment_reference'; end if;
  if exists (select 1 from public.store_subscriptions where store_id = p_store_id and status = 'pending') then
    raise exception 'subscription_pending_exists';
  end if;
  if (select count(*) from public.store_subscriptions
      where store_id = p_store_id and created_at > now() - interval '1 day') >= 5 then
    raise exception 'too_many_requests';
  end if;

  insert into public.store_subscriptions (store_id, plan_code, months, amount, currency, payment_method,
                                          payer_phone, payment_reference, note, requested_by)
  values (p_store_id, v_plan.code, p_months, v_plan.price_monthly * p_months, v_plan.currency, p_method,
          v_phone, v_ref, nullif(left(trim(coalesce(p_note, '')), 500), ''), (select auth.uid()))
  returning reference into v_out;

  perform public.log_activity('subscription.requested', p_store_id, 'subscription', v_out,
    jsonb_build_object('plan', v_plan.code, 'months', p_months, 'amount', v_plan.price_monthly * p_months));
  return v_out;
end $$;

create function public.cancel_subscription_request(p_subscription_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_sub public.store_subscriptions%rowtype;
begin
  select * into v_sub from public.store_subscriptions where id = p_subscription_id for update;
  if not found or not public.is_store_owner(v_sub.store_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_sub.status <> 'pending' then raise exception 'invalid_transition'; end if;
  update public.store_subscriptions set status = 'cancelled' where id = v_sub.id;
  perform public.log_activity('subscription.cancelled', v_sub.store_id, 'subscription', v_sub.reference);
end $$;

-- L'administrateur valide (après avoir vu le paiement) ou refuse.
create function public.admin_review_subscription(p_subscription_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_sub public.store_subscriptions%rowtype;
  v_start timestamptz;
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_sub from public.store_subscriptions where id = p_subscription_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_sub.status <> 'pending' then raise exception 'invalid_transition'; end if;

  if p_approve then
    -- Un renouvellement du même plan prolonge la période en cours.
    select greatest(now(), coalesce(max(ends_at), now())) into v_start
    from public.store_subscriptions
    where store_id = v_sub.store_id and plan_code = v_sub.plan_code and status = 'active' and ends_at > now();
    update public.store_subscriptions
    set status = 'active', starts_at = v_start, ends_at = v_start + make_interval(months => v_sub.months),
        admin_note = nullif(left(trim(coalesce(p_note, '')), 500), ''),
        reviewed_by = (select auth.uid()), reviewed_at = now()
    where id = v_sub.id;
  else
    if char_length(trim(coalesce(p_note, ''))) < 3 then raise exception 'reason_required'; end if;
    update public.store_subscriptions
    set status = 'rejected', admin_note = left(trim(p_note), 500),
        reviewed_by = (select auth.uid()), reviewed_at = now()
    where id = v_sub.id;
  end if;

  perform public.log_activity(case when p_approve then 'admin.subscription_approved' else 'admin.subscription_rejected' end,
    v_sub.store_id, 'subscription', v_sub.reference,
    jsonb_build_object('plan', v_sub.plan_code, 'months', v_sub.months, 'note', p_note));
end $$;

-- Activation directe par l'administrateur (offre, paiement reçu hors application).
create function public.admin_grant_subscription(p_store_id uuid, p_plan_code text, p_months integer, p_note text default null)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_plan public.plans%rowtype;
  v_start timestamptz;
  v_ref text;
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.stores where id = p_store_id) then raise exception 'not_found'; end if;
  select * into v_plan from public.plans where code = p_plan_code;
  if not found or v_plan.code = 'free' then raise exception 'invalid_plan'; end if;
  if p_months not in (1, 3, 6, 12) then raise exception 'invalid_months'; end if;

  select greatest(now(), coalesce(max(ends_at), now())) into v_start
  from public.store_subscriptions
  where store_id = p_store_id and plan_code = v_plan.code and status = 'active' and ends_at > now();

  insert into public.store_subscriptions (store_id, plan_code, months, amount, currency, status, admin_note,
                                          starts_at, ends_at, requested_by, reviewed_by, reviewed_at)
  values (p_store_id, v_plan.code, p_months, 0, v_plan.currency, 'active',
          nullif(left(trim(coalesce(p_note, '')), 500), ''),
          v_start, v_start + make_interval(months => p_months),
          (select auth.uid()), (select auth.uid()), now())
  returning reference into v_ref;

  perform public.log_activity('admin.subscription_granted', p_store_id, 'subscription', v_ref,
    jsonb_build_object('plan', v_plan.code, 'months', p_months, 'note', p_note));
  return v_ref;
end $$;

create function public.admin_end_subscription(p_subscription_id uuid, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_sub public.store_subscriptions%rowtype;
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_sub from public.store_subscriptions where id = p_subscription_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_sub.status <> 'active' or v_sub.ends_at <= now() then raise exception 'invalid_transition'; end if;
  update public.store_subscriptions
  set status = 'cancelled', ends_at = greatest(starts_at + interval '1 second', least(ends_at, now())),
      admin_note = coalesce(nullif(left(trim(coalesce(p_note, '')), 500), ''), admin_note),
      reviewed_by = (select auth.uid()), reviewed_at = now()
  where id = v_sub.id;
  perform public.log_activity('admin.subscription_ended', v_sub.store_id, 'subscription', v_sub.reference,
    jsonb_build_object('note', p_note));
end $$;

create function public.admin_update_plan(p_code text, p_payload jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_old public.plans%rowtype;
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_old from public.plans where code = p_code for update;
  if not found then raise exception 'not_found'; end if;
  update public.plans set
    price_monthly = case when p_code = 'free' then 0
                         else coalesce(nullif(p_payload ->> 'price_monthly', '')::numeric, price_monthly) end,
    max_couriers = coalesce(nullif(p_payload ->> 'max_couriers', '')::integer, max_couriers),
    max_staff = coalesce(nullif(p_payload ->> 'max_staff', '')::integer, max_staff),
    tracking = coalesce(nullif(p_payload ->> 'tracking', '')::public.tracking_level, tracking),
    is_public = case when p_code = 'free' then true
                     else coalesce((p_payload ->> 'is_public')::boolean, is_public) end,
    updated_by = (select auth.uid())
  where code = p_code;
  perform public.log_activity('admin.plan_updated', null, 'plan', p_code,
    jsonb_build_object('from', to_jsonb(v_old), 'to', p_payload));
exception
  when invalid_text_representation or numeric_value_out_of_range or check_violation then
    raise exception 'invalid_plan_value';
end $$;

-- ---------------------------------------------------------------------
-- 3. Limites appliquées par les RPC existantes
-- ---------------------------------------------------------------------
create or replace function public.create_delivery_job(p_order_id uuid, p_options jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_store public.stores%rowtype;
  v_opts jsonb := coalesce(p_options, '{}'::jsonb);
  v_pickup_address text;
  v_pickup_lat double precision;
  v_pickup_lng double precision;
  v_collect numeric;
  v_summary text;
  v_job uuid;
  v_ref text;
  v_token text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'not_found'; end if;
  if not (public.has_store_permission(v_order.store_id, 'couriers.assign')
          or public.has_store_permission(v_order.store_id, 'orders.edit')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_store from public.stores where id = v_order.store_id;
  if v_store.status <> 'active' then raise exception 'store_suspended'; end if;
  if (public.store_plan(v_store.id)).max_couriers = 0 then raise exception 'plan_no_couriers'; end if;
  if v_order.delivery_mode <> 'delivery' then raise exception 'order_is_pickup'; end if;
  if v_order.status in ('delivered', 'cancelled') then raise exception 'order_closed'; end if;
  if v_order.delivery_address is null then raise exception 'address_required'; end if;
  if v_order.current_job_id is not null and exists (
    select 1 from public.delivery_jobs
    where id = v_order.current_job_id and status not in ('delivered', 'failed', 'cancelled')
  ) then
    raise exception 'job_already_exists';
  end if;

  v_pickup_address := coalesce(nullif(trim(v_opts ->> 'pickup_address'), ''), v_store.address);
  if v_pickup_address is null then raise exception 'pickup_address_required'; end if;
  v_pickup_lat := coalesce(nullif(v_opts ->> 'pickup_lat', '')::double precision, v_store.lat);
  v_pickup_lng := coalesce(nullif(v_opts ->> 'pickup_lng', '')::double precision, v_store.lng);

  v_collect := case
    when nullif(v_opts ->> 'collect_amount', '') is not null then greatest((v_opts ->> 'collect_amount')::numeric, 0)
    when v_order.payment_status = 'unpaid' and v_order.payment_method = 'cash_on_delivery' then v_order.total
    else 0
  end;

  select left(string_agg(quantity::text || ' × ' || name || coalesce(' (' || variant_name || ')', ''), ', ' order by created_at), 500)
    into v_summary
  from public.order_items where order_id = p_order_id;

  insert into public.delivery_jobs (
    source, store_id, order_id, pickup_name, pickup_phone, pickup_address, pickup_lat, pickup_lng,
    dropoff_name, dropoff_phone, dropoff_address, dropoff_lat, dropoff_lng,
    package_description, instructions, distance_km, price, collect_amount, currency,
    payment_method, payment_status, payer, share_courier_phone, created_by
  ) values (
    'store_order', v_store.id, v_order.id, v_store.name, coalesce(v_store.phone, v_store.whatsapp),
    v_pickup_address, v_pickup_lat, v_pickup_lng,
    v_order.customer_name, v_order.customer_phone, v_order.delivery_address, v_order.delivery_lat, v_order.delivery_lng,
    coalesce(nullif(trim(v_opts ->> 'package_description'), ''), v_summary),
    coalesce(nullif(trim(v_opts ->> 'instructions'), ''), v_order.instructions),
    round(public.haversine_km(v_pickup_lat, v_pickup_lng, v_order.delivery_lat, v_order.delivery_lng)::numeric, 2),
    v_order.delivery_fee, v_collect, v_order.currency,
    v_order.payment_method, v_order.payment_status, 'recipient', v_store.share_courier_phone, (select auth.uid())
  )
  returning id, reference, tracking_token into v_job, v_ref, v_token;

  update public.orders set current_job_id = v_job where id = v_order.id;
  perform public.log_activity('delivery.created', v_store.id, 'delivery_job', v_job::text,
    jsonb_build_object('reference', v_ref, 'order', v_order.reference));

  if public.try_uuid(v_opts ->> 'courier_id') is not null then
    perform public.assign_courier(v_job, (v_opts ->> 'courier_id')::uuid);
  end if;

  return jsonb_build_object('id', v_job, 'reference', v_ref, 'tracking_token', v_token);
end $$;

create or replace function public.assign_courier(p_job_id uuid, p_courier_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_job public.delivery_jobs%rowtype;
  v_courier public.couriers%rowtype;
  v_max integer;
begin
  select * into v_job from public.delivery_jobs where id = p_job_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_job.store_id is null or not public.has_store_permission(v_job.store_id, 'couriers.assign') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_job.status not in ('pending', 'offered', 'accepted') then raise exception 'job_not_assignable'; end if;

  v_max := (public.store_plan(v_job.store_id)).max_couriers;
  if v_max = 0 then raise exception 'plan_no_couriers'; end if;
  if public.store_courier_count(v_job.store_id) > v_max then raise exception 'plan_courier_limit_exceeded'; end if;

  select * into v_courier from public.couriers where id = p_courier_id;
  if not found or v_courier.account_status <> 'active' or v_courier.user_id is null then
    raise exception 'courier_not_active';
  end if;
  if not exists (
    select 1 from public.courier_store_memberships
    where courier_id = p_courier_id and store_id = v_job.store_id and status = 'active'
  ) then
    raise exception 'courier_not_in_store';
  end if;

  if v_job.courier_id = p_courier_id and v_job.status in ('offered', 'accepted') then
    return;
  end if;

  update public.delivery_assignments set status = 'revoked', responded_at = now()
  where job_id = p_job_id and status in ('offered', 'accepted');

  insert into public.delivery_assignments (job_id, courier_id, status, offered_by)
  values (p_job_id, p_courier_id, 'offered', (select auth.uid()));

  update public.delivery_jobs
  set courier_id = p_courier_id, status = 'offered', offered_at = now(), accepted_at = null
  where id = p_job_id;

  insert into public.delivery_events (job_id, type, message, actor_id)
  values (p_job_id, 'courier_assigned', v_courier.full_name, (select auth.uid()));

  perform public.log_activity('delivery.assigned', v_job.store_id, 'delivery_job', p_job_id::text,
    jsonb_build_object('courier_id', p_courier_id, 'reference', v_job.reference));
end $$;

create or replace function public.store_add_courier(p_store_id uuid, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := left(trim(coalesce(p_payload ->> 'full_name', '')), 120);
  v_phone text := public.normalize_phone(p_payload ->> 'phone');
  v_vehicle text := nullif(p_payload ->> 'vehicle_type', '');
  v_token text := public.new_tracking_token();
  v_courier uuid;
begin
  if not public.is_store_owner(p_store_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if char_length(v_name) < 2 then raise exception 'invalid_name'; end if;
  if not public.is_valid_phone(v_phone) then raise exception 'invalid_phone'; end if;
  if public.store_courier_count(p_store_id) >= (public.store_plan(p_store_id)).max_couriers then
    raise exception 'plan_courier_limit';
  end if;

  insert into public.couriers (kind, full_name, phone, vehicle_type, vehicle_plate, zone, zone_lat, zone_lng, zone_radius_km,
                               account_status, notes, created_by)
  values (
    'private', v_name, v_phone, v_vehicle,
    nullif(left(trim(coalesce(p_payload ->> 'vehicle_plate', '')), 30), ''),
    nullif(left(trim(coalesce(p_payload ->> 'zone', '')), 120), ''),
    nullif(p_payload ->> 'zone_lat', '')::double precision,
    nullif(p_payload ->> 'zone_lng', '')::double precision,
    nullif(p_payload ->> 'zone_radius_km', '')::numeric,
    'invited',
    nullif(left(trim(coalesce(p_payload ->> 'notes', '')), 1000), ''),
    (select auth.uid())
  )
  returning id into v_courier;

  insert into public.courier_store_memberships (courier_id, store_id) values (v_courier, p_store_id);
  insert into public.invitations (kind, store_id, courier_id, label, token_hash, created_by)
  values ('courier', p_store_id, v_courier, v_name, public._hash_token(v_token), (select auth.uid()));

  perform public.log_activity('courier.added', p_store_id, 'courier', v_courier::text, jsonb_build_object('name', v_name));
  return jsonb_build_object('courier_id', v_courier, 'token', v_token);
end $$;

create or replace function public.store_set_courier_access(p_store_id uuid, p_courier_id uuid, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_current public.membership_status;
begin
  if not public.is_store_owner(p_store_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  select status into v_current from public.courier_store_memberships
  where courier_id = p_courier_id and store_id = p_store_id for update;
  if not found then raise exception 'not_found'; end if;
  if p_active and v_current <> 'active'
     and public.store_courier_count(p_store_id) >= (public.store_plan(p_store_id)).max_couriers then
    raise exception 'plan_courier_limit';
  end if;

  update public.courier_store_memberships
  set status = case when p_active then 'active'::public.membership_status else 'suspended'::public.membership_status end
  where courier_id = p_courier_id and store_id = p_store_id;

  if not p_active then
    -- Les propositions non encore acceptées repassent en attente d'attribution.
    update public.delivery_assignments a set status = 'revoked', responded_at = now()
    from public.delivery_jobs j
    where a.job_id = j.id and j.store_id = p_store_id and a.courier_id = p_courier_id and a.status = 'offered';
    update public.delivery_jobs set status = 'pending', courier_id = null
    where store_id = p_store_id and courier_id = p_courier_id and status = 'offered';
  end if;
  perform public.log_activity(case when p_active then 'courier.reactivated' else 'courier.suspended' end,
    p_store_id, 'courier', p_courier_id::text);
end $$;

create or replace function public.create_staff_invitation(p_store_id uuid, p_permissions text[], p_label text default null)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_token text := public.new_tracking_token();
  v_perms text[] := coalesce(p_permissions, '{}');
begin
  if not public.is_store_owner(p_store_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if not (v_perms <@ array['orders.create', 'orders.edit', 'products.view', 'products.manage',
                           'customers.view', 'couriers.assign', 'stats.view']::text[]) then
    raise exception 'invalid_permissions';
  end if;
  if public.store_staff_count(p_store_id) >= (public.store_plan(p_store_id)).max_staff then
    raise exception 'plan_staff_limit';
  end if;
  if (select count(*) from public.invitations
      where store_id = p_store_id and created_at > now() - interval '1 day') >= 50 then
    raise exception 'too_many_requests';
  end if;
  insert into public.invitations (kind, store_id, permissions, label, token_hash, created_by)
  values ('staff', p_store_id, v_perms, nullif(left(trim(coalesce(p_label, '')), 80), ''),
          public._hash_token(v_token), (select auth.uid()));
  perform public.log_activity('staff.invited', p_store_id, 'invitation', null, jsonb_build_object('permissions', v_perms));
  return v_token;
end $$;

-- ---------------------------------------------------------------------
-- 4. Position GPS réservée aux plans « suivi en direct »
-- ---------------------------------------------------------------------
-- Les colonnes de position ne sont plus lisibles directement : elles
-- passent par des fonctions qui vérifient le plan. Le temps réel de
-- Supabase applique les mêmes droits par colonne.
revoke select on public.couriers from authenticated;
grant select (
  id, user_id, kind, full_name, phone, vehicle_type, vehicle_plate, zone, zone_lat, zone_lng, zone_radius_km,
  account_status, availability, availability_changed_at, last_seen_at, id_document_path, notes, review_note,
  created_by, created_at, updated_at
) on public.couriers to authenticated;

revoke select on public.delivery_events from authenticated;
grant select (id, job_id, type, status, message, actor_id, created_at) on public.delivery_events to authenticated;

drop policy courier_locations_select on public.courier_locations;
create policy courier_locations_select on public.courier_locations for select to authenticated
  using (courier_id = (select public.my_courier_id()) or (select public.is_platform_admin()));

create or replace function public.store_courier_board(p_store_id uuid)
returns table (
  courier_id uuid,
  full_name text,
  phone text,
  kind public.courier_kind,
  vehicle_type text,
  vehicle_plate text,
  zone text,
  zone_lat double precision,
  zone_lng double precision,
  zone_radius_km numeric,
  account_status public.courier_account_status,
  membership_status public.membership_status,
  availability public.courier_availability,
  effective_status text,
  active_jobs integer,
  active_jobs_here integer,
  last_seen_at timestamptz,
  last_lat double precision,
  last_lng double precision,
  last_accuracy double precision,
  last_location_at timestamptz,
  linked boolean,
  delivered_30d integer,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_max integer;
  v_live boolean;
begin
  if not (public.is_store_owner(p_store_id) or public.has_store_permission(p_store_id, 'couriers.assign')
          or public.is_platform_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select courier_max_active_jobs into v_max from public.stores where id = p_store_id;
  v_live := public.is_platform_admin() or (public.store_plan(p_store_id)).tracking = 'live';

  return query
  with base as (
    select
      c.*,
      csm.status as m_status,
      public.courier_active_jobs(c.id) as aj,
      (select count(*)::integer from public.delivery_jobs j
        where j.courier_id = c.id and j.store_id = p_store_id
          and j.status in ('accepted', 'picked_up', 'in_transit')) as aj_here,
      (select count(*)::integer from public.delivery_jobs j
        where j.courier_id = c.id and j.store_id = p_store_id
          and j.status = 'delivered' and j.delivered_at > now() - interval '30 days') as d30
    from public.courier_store_memberships csm
    join public.couriers c on c.id = csm.courier_id
    where csm.store_id = p_store_id
  ),
  shown as (
    select b.*, (v_live and b.m_status = 'active' and (b.aj_here > 0 or b.availability = 'available')) as share
    from base b
  )
  select
    s.id, s.full_name, s.phone, s.kind, s.vehicle_type, s.vehicle_plate, s.zone, s.zone_lat, s.zone_lng, s.zone_radius_km,
    s.account_status, s.m_status, s.availability,
    case when s.m_status <> 'active' then 'inactive'
         else public.courier_effective_status(s.account_status, s.availability, s.last_seen_at, s.aj, v_max) end,
    s.aj, s.aj_here, s.last_seen_at,
    case when s.share then s.last_lat end,
    case when s.share then s.last_lng end,
    case when s.share then s.last_accuracy end,
    case when s.share then s.last_location_at end,
    s.user_id is not null, s.d30, s.created_at
  from shown s
  order by s.full_name;
end $$;

-- Position du livreur d'une course (fiche commande, carte en direct).
create function public.job_courier_position(p_job_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  j public.delivery_jobs%rowtype;
  c public.couriers%rowtype;
  v_stale integer := public.setting_int('location.stale_after_s', 120);
begin
  select * into j from public.delivery_jobs where id = p_job_id;
  if not found then raise exception 'not_found'; end if;
  if not (public.is_platform_admin() or (j.store_id is not null and public.is_store_member(j.store_id))) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not public.is_platform_admin() and (public.store_plan(j.store_id)).tracking <> 'live' then
    return jsonb_build_object('allowed', false, 'position', null);
  end if;
  if j.courier_id is null or j.status not in ('accepted', 'picked_up', 'in_transit') then
    return jsonb_build_object('allowed', true, 'position', null);
  end if;
  select * into c from public.couriers where id = j.courier_id;
  return jsonb_build_object(
    'allowed', true,
    'position', case when c.last_lat is not null and c.last_location_at is not null then jsonb_build_object(
      'lat', c.last_lat, 'lng', c.last_lng, 'accuracy', c.last_accuracy, 'heading', c.last_heading,
      'at', c.last_location_at, 'stale', c.last_location_at < now() - make_interval(secs => v_stale)) end
  );
end $$;

-- Suivi public : la carte en direct n'est montrée que pour les plans « live ».
create or replace function public.get_tracking(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  j public.delivery_jobs%rowtype;
  s public.stores%rowtype;
  c public.couriers%rowtype;
  v_stale integer := public.setting_int('location.stale_after_s', 120);
  v_level public.tracking_level;
  v_live boolean;
  v_pos jsonb;
  v_courier jsonb;
  v_events jsonb;
begin
  if p_token is null or char_length(p_token) <> 32 then return null; end if;
  select * into j from public.delivery_jobs where tracking_token = p_token;
  if not found then return null; end if;
  select * into s from public.stores where id = j.store_id;
  if j.courier_id is not null then select * into c from public.couriers where id = j.courier_id; end if;

  v_level := (public.store_plan(j.store_id)).tracking;
  v_live := j.tracking_active and j.status in ('accepted', 'picked_up', 'in_transit');

  if c.id is not null and j.status in ('accepted', 'picked_up', 'in_transit', 'delivered') then
    v_courier := jsonb_build_object(
      'first_name', split_part(c.full_name, ' ', 1),
      'vehicle_type', c.vehicle_type,
      'phone', case when j.share_courier_phone and v_live then c.phone end
    );
  end if;

  if v_level = 'live' and v_live and c.last_lat is not null and c.last_location_at is not null then
    v_pos := jsonb_build_object(
      'lat', c.last_lat, 'lng', c.last_lng, 'accuracy', c.last_accuracy, 'heading', c.last_heading,
      'at', c.last_location_at,
      'stale', c.last_location_at < now() - make_interval(secs => v_stale)
    );
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('type', e.type, 'status', e.status, 'at', e.created_at) order by e.created_at), '[]'::jsonb)
    into v_events
  from public.delivery_events e
  where e.job_id = j.id and e.type in ('created', 'status_changed', 'recipient_confirmed');

  return jsonb_build_object(
    'reference', j.reference,
    'status', j.status,
    'tracking_level', case when v_level = 'live' then 'live' else 'status' end,
    'store', jsonb_build_object(
      'name', s.name, 'slug', case when s.is_published then s.slug end,
      'logo_path', s.logo_path, 'phone', coalesce(s.whatsapp, s.phone)),
    'order_reference', (select o.reference from public.orders o where o.id = j.order_id),
    'pickup', jsonb_build_object('label', j.pickup_name, 'address', j.pickup_address,
                                 'lat', j.pickup_lat, 'lng', j.pickup_lng),
    'dropoff', jsonb_build_object('label', split_part(j.dropoff_name, ' ', 1), 'address', j.dropoff_address,
                                  'lat', j.dropoff_lat, 'lng', j.dropoff_lng),
    'package_type', j.package_type,
    'distance_km', j.distance_km,
    'collect_amount', j.collect_amount,
    'currency', j.currency,
    'payment_method', j.payment_method,
    'courier', v_courier,
    'position', v_pos,
    'live', v_live,
    'timestamps', jsonb_build_object(
      'created_at', j.created_at, 'accepted_at', j.accepted_at, 'picked_up_at', j.picked_up_at,
      'in_transit_at', j.in_transit_at, 'delivered_at', j.delivered_at, 'failed_at', j.failed_at,
      'cancelled_at', j.cancelled_at, 'recipient_confirmed_at', j.recipient_confirmed_at),
    'events', v_events,
    'stale_after_s', v_stale,
    'can_confirm', j.status = 'delivered' and j.recipient_confirmed_at is null,
    'server_time', now()
  );
end $$;

-- ---------------------------------------------------------------------
-- 5. Administration : livreurs (tous privés) et statistiques
-- ---------------------------------------------------------------------
create function public.admin_courier_board()
returns table (
  courier_id uuid,
  full_name text,
  phone text,
  vehicle_type text,
  zone text,
  account_status public.courier_account_status,
  availability public.courier_availability,
  effective_status text,
  active_jobs integer,
  last_seen_at timestamptz,
  store_names text,
  linked boolean,
  delivered_total integer,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select c.id, c.full_name, c.phone, c.vehicle_type, c.zone, c.account_status, c.availability,
    public.courier_effective_status(
      c.account_status, c.availability, c.last_seen_at, public.courier_active_jobs(c.id),
      coalesce((select max(s.courier_max_active_jobs) from public.courier_store_memberships m
                join public.stores s on s.id = m.store_id where m.courier_id = c.id and m.status = 'active'), 1)),
    public.courier_active_jobs(c.id), c.last_seen_at,
    (select string_agg(s.name, ', ' order by s.name) from public.courier_store_memberships m
       join public.stores s on s.id = m.store_id where m.courier_id = c.id),
    c.user_id is not null,
    (select count(*)::integer from public.delivery_jobs j where j.courier_id = c.id and j.status = 'delivered'),
    c.created_at
  from public.couriers c
  order by c.created_at desc;
end $$;

create function public.admin_set_courier_suspension(p_courier_id uuid, p_suspended boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_c public.couriers%rowtype;
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_c from public.couriers where id = p_courier_id for update;
  if not found then raise exception 'not_found'; end if;
  if p_suspended then
    if v_c.account_status = 'suspended' then raise exception 'invalid_transition'; end if;
    update public.couriers set account_status = 'suspended', availability = 'unavailable',
      review_note = nullif(trim(coalesce(p_note, '')), '') where id = v_c.id;
    update public.delivery_assignments set status = 'revoked', responded_at = now()
    where courier_id = v_c.id and status = 'offered';
    update public.delivery_jobs set status = 'pending', courier_id = null
    where courier_id = v_c.id and status = 'offered';
  else
    if v_c.account_status <> 'suspended' then raise exception 'invalid_transition'; end if;
    update public.couriers
    set account_status = case when v_c.user_id is null then 'invited'::public.courier_account_status
                              else 'active'::public.courier_account_status end,
        review_note = nullif(trim(coalesce(p_note, '')), '')
    where id = v_c.id;
  end if;
  perform public.log_activity(case when p_suspended then 'admin.courier_suspended' else 'admin.courier_reactivated' end,
    null, 'courier', v_c.id::text, jsonb_build_object('note', p_note, 'name', v_c.full_name));
end $$;

create or replace function public.admin_overview_stats(p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_result jsonb;
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  with current_plans as (
    select st.id, p.code, p.price_monthly
    from public.stores st
    join public.plans p on p.code = public.store_plan_code(st.id)
  )
  select jsonb_build_object(
    'stores_total', (select count(*) from public.stores),
    'stores_published', (select count(*) from public.stores where is_published and status = 'active'),
    'stores_suspended', (select count(*) from public.stores where status = 'suspended'),
    'users_total', (select count(*) from public.profiles),
    'users_suspended', (select count(*) from public.profiles where is_suspended),
    'couriers_total', (select count(*) from public.couriers),
    'couriers_linked', (select count(*) from public.couriers where user_id is not null and account_status = 'active'),
    'paid_stores', (select count(*) from current_plans where code <> 'free'),
    'mrr', (select coalesce(sum(price_monthly), 0) from current_plans),
    'pending_subscriptions', (select count(*) from public.store_subscriptions where status = 'pending'),
    'subscription_revenue', (select coalesce(sum(amount), 0) from public.store_subscriptions
                             where status in ('active', 'cancelled') and reviewed_at >= p_from and reviewed_at < p_to),
    'orders_count', (select count(*) from public.orders where created_at >= p_from and created_at < p_to),
    'gmv', (select coalesce(sum(total), 0) from public.orders
            where status = 'delivered' and delivered_at >= p_from and delivered_at < p_to),
    'active_jobs', (select count(*) from public.delivery_jobs where status in ('offered', 'accepted', 'picked_up', 'in_transit')),
    'delivered_count', (select count(*) from public.delivery_jobs
                        where status = 'delivered' and delivered_at >= p_from and delivered_at < p_to),
    'failed_count', (select count(*) from public.delivery_jobs
                     where status = 'failed' and failed_at >= p_from and failed_at < p_to),
    'open_claims', (select count(*) from public.claims where status in ('open', 'investigating')),
    'pending_transactions', (select count(*) from public.transactions where status = 'pending')
  ) into v_result;
  return v_result;
end $$;

drop function public.admin_daily_series(date, date, text);
create function public.admin_daily_series(p_from date, p_to date, p_tz text default 'Africa/Douala')
returns table (bucket_day date, orders_count integer, new_stores integer, delivered_count integer, failed_count integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_start timestamptz;
  v_end timestamptz;
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_to < p_from or p_to - p_from > 366 then raise exception 'invalid_range'; end if;
  v_start := p_from::timestamp at time zone p_tz;
  v_end := (p_to + 1)::timestamp at time zone p_tz;

  return query
  with days as (
    select g::date as d from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') g
  ),
  o as (
    select (x.created_at at time zone p_tz)::date as d, count(*)::integer as n
    from public.orders x where x.created_at >= v_start and x.created_at < v_end group by 1
  ),
  ns as (
    select (x.created_at at time zone p_tz)::date as d, count(*)::integer as n
    from public.stores x where x.created_at >= v_start and x.created_at < v_end group by 1
  ),
  dj as (
    select (x.delivered_at at time zone p_tz)::date as d, count(*)::integer as n
    from public.delivery_jobs x
    where x.status = 'delivered' and x.delivered_at >= v_start and x.delivered_at < v_end group by 1
  ),
  fj as (
    select (x.failed_at at time zone p_tz)::date as d, count(*)::integer as n
    from public.delivery_jobs x
    where x.status = 'failed' and x.failed_at >= v_start and x.failed_at < v_end group by 1
  )
  select days.d, coalesce(o.n, 0), coalesce(ns.n, 0), coalesce(dj.n, 0), coalesce(fj.n, 0)
  from days
  left join o on o.d = days.d
  left join ns on ns.d = days.d
  left join dj on dj.d = days.d
  left join fj on fj.d = days.d
  order by days.d;
end $$;

create or replace function public.admin_update_setting(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb;
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select value into v_old from public.platform_settings where key = p_key;
  if not found then raise exception 'not_found'; end if;
  if jsonb_typeof(v_old) <> jsonb_typeof(p_value) then raise exception 'invalid_setting_value'; end if;
  if jsonb_typeof(p_value) = 'number' and ((p_value #>> '{}')::numeric < 0 or (p_value #>> '{}')::numeric > 1000000) then
    raise exception 'invalid_setting_value';
  end if;
  if jsonb_typeof(p_value) = 'string' and char_length(p_value #>> '{}') > 200 then
    raise exception 'invalid_setting_value';
  end if;
  if p_key like 'location.%' and (p_value #>> '{}')::numeric < 3 then raise exception 'invalid_setting_value'; end if;
  update public.platform_settings set value = p_value, updated_by = (select auth.uid()) where key = p_key;
  perform public.log_activity('admin.setting_updated', null, 'setting', p_key,
    jsonb_build_object('from', v_old, 'to', p_value));
end $$;

-- ---------------------------------------------------------------------
-- 6. Droits : RLS, tables, fonctions
-- ---------------------------------------------------------------------
alter table public.plans enable row level security;
alter table public.store_subscriptions enable row level security;

create policy plans_select on public.plans for select to anon, authenticated using (true);
create policy store_subscriptions_select on public.store_subscriptions for select to authenticated
  using (public.is_store_owner(store_id) or (select public.is_platform_admin()));

revoke all on public.plans, public.store_subscriptions from anon, authenticated;
grant select on public.plans to anon, authenticated;
grant select on public.store_subscriptions to authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;

-- Fonctions utilisées dans les politiques RLS / stockage
grant execute on function
  public.is_platform_admin(), public.is_active_user(), public.is_store_member(uuid), public.is_store_owner(uuid),
  public.has_store_permission(uuid, text), public.my_courier_id(), public.is_store_courier_of(uuid),
  public.shares_store_with(uuid), public.try_uuid(text), public.is_store_courier(uuid)
to anon, authenticated;

-- RPC publiques (sans compte)
grant execute on function
  public.place_storefront_order(text, jsonb),
  public.get_tracking(text),
  public.confirm_delivery_receipt(text),
  public.submit_tracking_claim(text, text, text, text, text),
  public.get_invitation(text)
to anon, authenticated;

-- RPC authentifiées (chaque fonction vérifie elle-même les droits)
grant execute on function
  public.create_store(jsonb),
  public.create_order(uuid, jsonb),
  public.set_order_items(uuid, jsonb),
  public.set_order_status(uuid, public.order_status, text),
  public.add_order_note(uuid, text),
  public.create_staff_invitation(uuid, text[], text),
  public.revoke_invitation(uuid),
  public.accept_invitation(text),
  public.update_member_permissions(uuid, uuid, text[]),
  public.remove_store_member(uuid, uuid),
  public.create_delivery_job(uuid, jsonb),
  public.assign_courier(uuid, uuid),
  public.unassign_courier(uuid),
  public.cancel_delivery_job(uuid, text),
  public.store_courier_board(uuid),
  public.job_courier_position(uuid),
  public.store_add_courier(uuid, jsonb),
  public.store_create_courier_invite(uuid, uuid),
  public.store_update_courier(uuid, uuid, jsonb),
  public.store_set_courier_access(uuid, uuid, boolean),
  public.courier_settings(),
  public.courier_set_availability(boolean),
  public.courier_heartbeat(),
  public.report_courier_location(double precision, double precision, double precision, double precision, double precision, timestamptz),
  public.courier_respond_offer(uuid, boolean, text),
  public.courier_update_job(uuid, public.job_status, jsonb),
  public.courier_report_issue(uuid, text, text),
  public.courier_update_profile(jsonb),
  public.store_plan_info(uuid),
  public.billing_payment_details(),
  public.request_subscription(uuid, text, integer, public.payment_method, text, text, text),
  public.cancel_subscription_request(uuid),
  public.admin_review_subscription(uuid, boolean, text),
  public.admin_grant_subscription(uuid, text, integer, text),
  public.admin_end_subscription(uuid, text),
  public.admin_update_plan(text, jsonb),
  public.admin_courier_board(),
  public.admin_set_courier_suspension(uuid, boolean, text),
  public.admin_set_user_suspension(uuid, boolean, text),
  public.admin_set_store_status(uuid, public.store_status, text),
  public.admin_set_platform_admin(uuid, boolean),
  public.admin_update_setting(text, jsonb),
  public.record_payment(jsonb),
  public.confirm_transaction(uuid, public.transaction_status),
  public.store_dashboard_stats(uuid, timestamptz, timestamptz),
  public.store_daily_series(uuid, date, date, text),
  public.store_top_products(uuid, timestamptz, timestamptz, integer),
  public.store_courier_performance(uuid, timestamptz, timestamptz),
  public.admin_overview_stats(timestamptz, timestamptz),
  public.admin_daily_series(date, date, text)
to authenticated;
