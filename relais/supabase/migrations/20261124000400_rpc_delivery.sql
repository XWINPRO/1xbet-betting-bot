-- =====================================================================
-- Relais · 004 — RPC logistique : courses, attribution, livreurs, GPS,
-- suivi public, livraisons ponctuelles.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Création d'une course pour une commande de boutique
-- ---------------------------------------------------------------------
create function public.create_delivery_job(p_order_id uuid, p_options jsonb default '{}'::jsonb) returns jsonb
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

-- ---------------------------------------------------------------------
-- Attribution (le commerçant ou l'administrateur garde la main)
-- ---------------------------------------------------------------------
create function public.assign_courier(p_job_id uuid, p_courier_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_job public.delivery_jobs%rowtype;
  v_courier public.couriers%rowtype;
  v_is_admin boolean := public.is_platform_admin();
begin
  select * into v_job from public.delivery_jobs where id = p_job_id for update;
  if not found then raise exception 'not_found'; end if;

  if v_job.store_id is not null then
    if not (public.has_store_permission(v_job.store_id, 'couriers.assign') or v_is_admin) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  elsif not v_is_admin then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_job.status not in ('pending', 'offered', 'accepted') then raise exception 'job_not_assignable'; end if;

  select * into v_courier from public.couriers where id = p_courier_id;
  if not found or v_courier.account_status <> 'active' or v_courier.user_id is null then
    raise exception 'courier_not_active';
  end if;

  if v_job.store_id is not null then
    if not exists (
      select 1 from public.courier_store_memberships
      where courier_id = p_courier_id and store_id = v_job.store_id and status = 'active'
    ) and not (v_is_admin and v_courier.kind = 'platform') then
      raise exception 'courier_not_in_store';
    end if;
  elsif v_courier.kind <> 'platform' then
    raise exception 'courier_not_platform';
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

create function public.unassign_courier(p_job_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_job public.delivery_jobs%rowtype;
begin
  select * into v_job from public.delivery_jobs where id = p_job_id for update;
  if not found then raise exception 'not_found'; end if;
  if not ((v_job.store_id is not null and public.has_store_permission(v_job.store_id, 'couriers.assign'))
          or public.is_platform_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_job.status not in ('offered', 'accepted') then raise exception 'job_not_assignable'; end if;

  update public.delivery_assignments set status = 'revoked', responded_at = now()
  where job_id = p_job_id and status in ('offered', 'accepted');
  update public.delivery_jobs set status = 'pending', courier_id = null where id = p_job_id;
  insert into public.delivery_events (job_id, type, actor_id) values (p_job_id, 'courier_unassigned', (select auth.uid()));
end $$;

create function public.cancel_delivery_job(p_job_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_job public.delivery_jobs%rowtype;
begin
  select * into v_job from public.delivery_jobs where id = p_job_id for update;
  if not found then raise exception 'not_found'; end if;
  if not ((v_job.store_id is not null and (
            public.has_store_permission(v_job.store_id, 'couriers.assign')
            or public.has_store_permission(v_job.store_id, 'orders.edit')))
          or public.is_platform_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_job.status in ('delivered', 'failed', 'cancelled') then raise exception 'job_closed'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'reason_required'; end if;

  update public.delivery_assignments set status = 'revoked', responded_at = now()
  where job_id = p_job_id and status in ('offered', 'accepted');
  update public.delivery_jobs set status = 'cancelled', cancel_reason = left(trim(p_reason), 500) where id = p_job_id;
  perform public.log_activity('delivery.cancelled', v_job.store_id, 'delivery_job', p_job_id::text,
    jsonb_build_object('reference', v_job.reference, 'reason', p_reason));
end $$;

-- ---------------------------------------------------------------------
-- Tableau des livreurs d'une boutique (disponibilité calculée)
-- La position n'est exposée que si le livreur partage activement :
-- course en cours pour cette boutique, ou statut « disponible ».
-- ---------------------------------------------------------------------
create function public.store_courier_board(p_store_id uuid)
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
begin
  if not (public.is_store_owner(p_store_id) or public.has_store_permission(p_store_id, 'couriers.assign')
          or public.is_platform_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select courier_max_active_jobs into v_max from public.stores where id = p_store_id;

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
  )
  select
    b.id, b.full_name, b.phone, b.kind, b.vehicle_type, b.vehicle_plate, b.zone, b.zone_lat, b.zone_lng, b.zone_radius_km,
    b.account_status, b.m_status, b.availability,
    case when b.m_status <> 'active' then 'inactive'
         else public.courier_effective_status(b.account_status, b.availability, b.last_seen_at, b.aj, v_max) end,
    b.aj, b.aj_here, b.last_seen_at,
    case when b.m_status = 'active' and (b.aj_here > 0 or b.availability = 'available') then b.last_lat end,
    case when b.m_status = 'active' and (b.aj_here > 0 or b.availability = 'available') then b.last_lng end,
    case when b.m_status = 'active' and (b.aj_here > 0 or b.availability = 'available') then b.last_accuracy end,
    case when b.m_status = 'active' and (b.aj_here > 0 or b.availability = 'available') then b.last_location_at end,
    b.user_id is not null, b.d30, b.created_at
  from base b
  order by b.full_name;
end $$;

-- Livreurs du réseau (vue administrateur) avec disponibilité calculée.
create function public.admin_courier_board(p_kind public.courier_kind default null)
returns table (
  courier_id uuid,
  full_name text,
  phone text,
  kind public.courier_kind,
  vehicle_type text,
  zone text,
  account_status public.courier_account_status,
  availability public.courier_availability,
  effective_status text,
  active_jobs integer,
  last_seen_at timestamptz,
  last_lat double precision,
  last_lng double precision,
  last_location_at timestamptz,
  stores_count integer,
  delivered_total integer,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_max integer := public.setting_int('dispatch.platform_max_active_jobs', 1);
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select c.id, c.full_name, c.phone, c.kind, c.vehicle_type, c.zone, c.account_status, c.availability,
    public.courier_effective_status(c.account_status, c.availability, c.last_seen_at, public.courier_active_jobs(c.id), v_max),
    public.courier_active_jobs(c.id), c.last_seen_at,
    case when c.availability = 'available' or public.courier_active_jobs(c.id) > 0 then c.last_lat end,
    case when c.availability = 'available' or public.courier_active_jobs(c.id) > 0 then c.last_lng end,
    case when c.availability = 'available' or public.courier_active_jobs(c.id) > 0 then c.last_location_at end,
    (select count(*)::integer from public.courier_store_memberships m where m.courier_id = c.id),
    (select count(*)::integer from public.delivery_jobs j where j.courier_id = c.id and j.status = 'delivered'),
    c.created_at
  from public.couriers c
  where p_kind is null or c.kind = p_kind
  order by c.created_at desc;
end $$;

-- ---------------------------------------------------------------------
-- Gestion des livreurs privés par la boutique
-- ---------------------------------------------------------------------
create function public.store_add_courier(p_store_id uuid, p_payload jsonb) returns jsonb
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
  if (select count(*) from public.courier_store_memberships where store_id = p_store_id) >= 200 then
    raise exception 'courier_limit_reached';
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

create function public.store_create_courier_invite(p_store_id uuid, p_courier_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_token text := public.new_tracking_token();
  v_courier public.couriers%rowtype;
begin
  if not public.is_store_owner(p_store_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  select c.* into v_courier from public.couriers c
  join public.courier_store_memberships m on m.courier_id = c.id and m.store_id = p_store_id
  where c.id = p_courier_id;
  if not found then raise exception 'not_found'; end if;
  if v_courier.user_id is not null then raise exception 'courier_already_linked'; end if;

  update public.invitations set revoked_at = now()
  where store_id = p_store_id and courier_id = p_courier_id and accepted_at is null and revoked_at is null;
  insert into public.invitations (kind, store_id, courier_id, label, token_hash, created_by)
  values ('courier', p_store_id, p_courier_id, v_courier.full_name, public._hash_token(v_token), (select auth.uid()));
  return v_token;
end $$;

create function public.store_update_courier(p_store_id uuid, p_courier_id uuid, p_payload jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := left(trim(coalesce(p_payload ->> 'full_name', '')), 120);
  v_phone text := public.normalize_phone(p_payload ->> 'phone');
begin
  if not public.is_store_owner(p_store_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.courier_store_memberships m join public.couriers c on c.id = m.courier_id
    where m.courier_id = p_courier_id and m.store_id = p_store_id and c.kind = 'private'
  ) then
    raise exception 'not_found';
  end if;
  if char_length(v_name) < 2 then raise exception 'invalid_name'; end if;
  if not public.is_valid_phone(v_phone) then raise exception 'invalid_phone'; end if;

  update public.couriers set
    full_name = v_name,
    phone = v_phone,
    vehicle_type = nullif(p_payload ->> 'vehicle_type', ''),
    vehicle_plate = nullif(left(trim(coalesce(p_payload ->> 'vehicle_plate', '')), 30), ''),
    zone = nullif(left(trim(coalesce(p_payload ->> 'zone', '')), 120), ''),
    zone_lat = nullif(p_payload ->> 'zone_lat', '')::double precision,
    zone_lng = nullif(p_payload ->> 'zone_lng', '')::double precision,
    zone_radius_km = nullif(p_payload ->> 'zone_radius_km', '')::numeric,
    notes = nullif(left(trim(coalesce(p_payload ->> 'notes', '')), 1000), '')
  where id = p_courier_id;
  perform public.log_activity('courier.updated', p_store_id, 'courier', p_courier_id::text);
end $$;

create function public.store_set_courier_access(p_store_id uuid, p_courier_id uuid, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_store_owner(p_store_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.courier_store_memberships
  set status = case when p_active then 'active'::public.membership_status else 'suspended'::public.membership_status end
  where courier_id = p_courier_id and store_id = p_store_id;
  if not found then raise exception 'not_found'; end if;

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

-- ---------------------------------------------------------------------
-- Espace livreur
-- ---------------------------------------------------------------------
create function public.courier_settings() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'active_interval_s', public.setting_int('location.active_interval_s', 10),
    'idle_interval_s', public.setting_int('location.idle_interval_s', 60),
    'stale_after_s', public.setting_int('location.stale_after_s', 120),
    'offline_after_s', public.setting_int('courier.offline_after_s', 180)
  )
$$;

create function public.courier_set_availability(p_available boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_c public.couriers%rowtype;
  v_active integer;
begin
  select * into v_c from public.couriers where id = public.my_courier_id() for update;
  if not found then raise exception 'not_a_courier'; end if;
  if v_c.account_status <> 'active' then raise exception 'courier_not_active'; end if;
  v_active := public.courier_active_jobs(v_c.id);

  if p_available then
    update public.couriers
    set availability = 'available', availability_changed_at = now(), last_seen_at = now()
    where id = v_c.id;
  else
    -- Hors course, la dernière position n'est plus conservée sur le profil.
    update public.couriers
    set availability = 'unavailable', availability_changed_at = now(), last_seen_at = now(),
        last_lat = case when v_active > 0 then last_lat end,
        last_lng = case when v_active > 0 then last_lng end,
        last_accuracy = case when v_active > 0 then last_accuracy end,
        last_heading = case when v_active > 0 then last_heading end,
        last_speed = case when v_active > 0 then last_speed end,
        last_location_at = case when v_active > 0 then last_location_at end
    where id = v_c.id;
  end if;
  return jsonb_build_object('availability', case when p_available then 'available' else 'unavailable' end,
                            'active_jobs', v_active);
end $$;

create function public.courier_heartbeat() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := public.my_courier_id();
begin
  if v_id is null then raise exception 'not_a_courier'; end if;
  update public.couriers set last_seen_at = now() where id = v_id;
  return public.courier_settings();
end $$;

-- Réception d'une position GPS réelle envoyée par le téléphone du livreur.
-- Stockée uniquement pendant une course active ou si le livreur s'est déclaré disponible.
create function public.report_courier_location(
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision default null,
  p_heading double precision default null,
  p_speed double precision default null,
  p_recorded_at timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_c public.couriers%rowtype;
  v_now timestamptz := now();
  v_recorded timestamptz := least(coalesce(p_recorded_at, now()), now());
  v_job uuid;
  v_tokens text[];
  v_last_received timestamptz;
  v_token text;
begin
  select * into v_c from public.couriers where id = public.my_courier_id() for update;
  if not found then raise exception 'not_a_courier'; end if;
  if v_c.account_status <> 'active' then raise exception 'courier_not_active'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'invalid_coordinates';
  end if;
  if p_accuracy is not null and (p_accuracy < 0 or p_accuracy > 100000) then raise exception 'invalid_accuracy'; end if;

  select array_agg(tracking_token), (array_agg(id order by accepted_at desc nulls last))[1]
    into v_tokens, v_job
  from public.delivery_jobs
  where courier_id = v_c.id and status in ('accepted', 'picked_up', 'in_transit');

  if v_job is null and v_c.availability <> 'available' then
    update public.couriers set last_seen_at = v_now where id = v_c.id;
    return jsonb_build_object('stored', false, 'reason', 'not_sharing',
      'interval_s', public.setting_int('location.idle_interval_s', 60));
  end if;

  select max(received_at) into v_last_received from public.courier_locations where courier_id = v_c.id;
  if v_last_received is not null and v_last_received > v_now - interval '2 seconds' then
    update public.couriers set last_seen_at = v_now where id = v_c.id;
    return jsonb_build_object('stored', false, 'reason', 'rate_limited',
      'interval_s', public.setting_int('location.active_interval_s', 10));
  end if;

  update public.couriers set
    last_seen_at = v_now,
    last_lat = p_lat,
    last_lng = p_lng,
    last_accuracy = p_accuracy,
    last_heading = p_heading,
    last_speed = p_speed,
    last_location_at = v_recorded
  where id = v_c.id;

  insert into public.courier_locations (courier_id, job_id, lat, lng, accuracy, heading, speed, recorded_at)
  values (v_c.id, v_job, p_lat, p_lng, p_accuracy, p_heading, p_speed, v_recorded);

  if v_tokens is not null then
    foreach v_token in array v_tokens loop
      perform public.broadcast_tracking(v_token);
    end loop;
  end if;

  return jsonb_build_object(
    'stored', true,
    'active_job', v_job is not null,
    'interval_s', case when v_job is not null
      then public.setting_int('location.active_interval_s', 10)
      else public.setting_int('location.idle_interval_s', 60) end
  );
end $$;

create function public.courier_respond_offer(p_job_id uuid, p_accept boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_courier uuid := public.my_courier_id();
  v_c public.couriers%rowtype;
  v_job public.delivery_jobs%rowtype;
begin
  if v_courier is null then raise exception 'not_a_courier'; end if;
  select * into v_c from public.couriers where id = v_courier;
  if v_c.account_status <> 'active' then raise exception 'courier_not_active'; end if;
  select * into v_job from public.delivery_jobs
  where id = p_job_id and courier_id = v_courier and status = 'offered' for update;
  if not found then raise exception 'offer_not_found'; end if;

  if p_accept then
    update public.delivery_jobs set status = 'accepted' where id = p_job_id;
    update public.delivery_assignments set status = 'accepted', responded_at = now()
    where job_id = p_job_id and courier_id = v_courier and status = 'offered';
  else
    update public.delivery_jobs set status = 'pending', courier_id = null where id = p_job_id;
    update public.delivery_assignments set status = 'declined', responded_at = now(),
      note = nullif(left(trim(coalesce(p_reason, '')), 300), '')
    where job_id = p_job_id and courier_id = v_courier and status = 'offered';
    insert into public.delivery_events (job_id, type, message, actor_id)
    values (p_job_id, 'offer_declined', nullif(left(trim(coalesce(p_reason, '')), 300), ''), (select auth.uid()));
  end if;
end $$;

-- Courses ponctuelles en attente visibles par un livreur du réseau disponible.
-- Les numéros de téléphone ne sont révélés qu'après acceptation.
create function public.courier_open_jobs()
returns table (
  id uuid,
  reference text,
  pickup_address text,
  pickup_lat double precision,
  pickup_lng double precision,
  dropoff_address text,
  dropoff_lat double precision,
  dropoff_lng double precision,
  package_type text,
  distance_km numeric,
  price numeric,
  currency text,
  created_at timestamptz,
  distance_to_pickup_km double precision
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_c public.couriers%rowtype;
  v_radius integer := public.setting_int('dispatch.open_pool_radius_km', 15);
begin
  select * into v_c from public.couriers
  where couriers.id = public.my_courier_id() and kind = 'platform' and account_status = 'active' and availability = 'available';
  if not found then return; end if;

  return query
  select j.id, j.reference, j.pickup_address, j.pickup_lat, j.pickup_lng, j.dropoff_address, j.dropoff_lat, j.dropoff_lng,
         j.package_type, j.distance_km, j.price, j.currency, j.created_at,
         public.haversine_km(v_c.last_lat, v_c.last_lng, j.pickup_lat, j.pickup_lng)
  from public.delivery_jobs j
  where j.source = 'on_demand' and j.status = 'pending' and j.courier_id is null
    and (v_c.last_lat is null or j.pickup_lat is null
         or public.haversine_km(v_c.last_lat, v_c.last_lng, j.pickup_lat, j.pickup_lng) <= v_radius)
  order by public.haversine_km(v_c.last_lat, v_c.last_lng, j.pickup_lat, j.pickup_lng) asc nulls last, j.created_at
  limit 30;
end $$;

create function public.courier_claim_job(p_job_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_c public.couriers%rowtype;
  v_job public.delivery_jobs%rowtype;
begin
  select * into v_c from public.couriers where id = public.my_courier_id() for update;
  if not found then raise exception 'not_a_courier'; end if;
  if v_c.kind <> 'platform' or v_c.account_status <> 'active' then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_c.availability <> 'available' then raise exception 'courier_unavailable'; end if;
  if public.courier_active_jobs(v_c.id) >= public.setting_int('dispatch.platform_max_active_jobs', 1) then
    raise exception 'courier_busy';
  end if;

  select * into v_job from public.delivery_jobs
  where id = p_job_id and source = 'on_demand' and status = 'pending' and courier_id is null
  for update skip locked;
  if not found then raise exception 'job_taken'; end if;

  update public.delivery_jobs set courier_id = v_c.id, status = 'accepted' where id = p_job_id;
  insert into public.delivery_assignments (job_id, courier_id, status, responded_at, note)
  values (p_job_id, v_c.id, 'accepted', now(), 'Acceptée depuis les courses disponibles');
end $$;

-- Progression d'une course par le livreur assigné.
create function public.courier_update_job(p_job_id uuid, p_status public.job_status, p_payload jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_courier uuid := public.my_courier_id();
  v_job public.delivery_jobs%rowtype;
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_reason text := nullif(left(trim(coalesce(v_payload ->> 'reason', '')), 500), '');
  v_note text := nullif(left(trim(coalesce(v_payload ->> 'note', '')), 1000), '');
  v_proof text := nullif(v_payload ->> 'proof_photo_path', '');
  v_cash boolean := coalesce((v_payload ->> 'cash_collected')::boolean, false);
  v_lat double precision := nullif(v_payload ->> 'lat', '')::double precision;
  v_lng double precision := nullif(v_payload ->> 'lng', '')::double precision;
begin
  if v_courier is null then raise exception 'not_a_courier'; end if;
  select * into v_job from public.delivery_jobs where id = p_job_id and courier_id = v_courier for update;
  if not found then raise exception 'not_found'; end if;

  if not (
    (v_job.status = 'accepted' and p_status in ('picked_up', 'failed'))
    or (v_job.status = 'picked_up' and p_status in ('in_transit', 'delivered', 'failed'))
    or (v_job.status = 'in_transit' and p_status in ('delivered', 'failed'))
  ) then
    raise exception 'invalid_transition';
  end if;

  if p_status = 'failed' and v_reason is null then raise exception 'reason_required'; end if;
  if v_proof is not null and v_proof not like (p_job_id::text || '/%') then raise exception 'invalid_proof_path'; end if;

  update public.delivery_jobs set
    status = p_status,
    failure_reason = case when p_status = 'failed' then v_reason else failure_reason end,
    proof_photo_path = case when p_status = 'delivered' then coalesce(v_proof, proof_photo_path) else proof_photo_path end,
    proof_note = case when p_status = 'delivered' then coalesce(v_note, proof_note) else proof_note end,
    proof_recipient_name = case when p_status = 'delivered'
      then coalesce(nullif(left(trim(coalesce(v_payload ->> 'recipient_name', '')), 120), ''), proof_recipient_name)
      else proof_recipient_name end,
    cash_collected = case when p_status = 'delivered' then v_cash and collect_amount > 0 else cash_collected end
  where id = p_job_id;

  -- Ajoute la note et la position au dernier événement de statut.
  update public.delivery_events set
    message = coalesce(v_reason, v_note),
    lat = case when v_lat between -90 and 90 then v_lat end,
    lng = case when v_lng between -180 and 180 then v_lng end
  where id = (select max(id) from public.delivery_events where job_id = p_job_id and type = 'status_changed');

  -- Espèces encaissées par le livreur : transaction en attente de remise à la boutique.
  if p_status = 'delivered' and v_cash and v_job.collect_amount > 0 then
    insert into public.transactions (store_id, order_id, job_id, amount, currency, method, provider, status, notes, recorded_by)
    values (v_job.store_id, v_job.order_id, p_job_id, v_job.collect_amount, v_job.currency, 'cash_on_delivery', 'cash',
            'pending', 'Espèces encaissées par le livreur, à remettre', (select auth.uid()));
    perform public._refresh_payment_status(v_job.order_id, case when v_job.order_id is null then p_job_id end);
  end if;
end $$;

create function public.courier_report_issue(p_job_id uuid, p_category text, p_description text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_courier uuid := public.my_courier_id();
  v_c public.couriers%rowtype;
  v_job public.delivery_jobs%rowtype;
  v_ref text;
begin
  if v_courier is null then raise exception 'not_a_courier'; end if;
  select * into v_c from public.couriers where id = v_courier;
  select * into v_job from public.delivery_jobs where id = p_job_id and courier_id = v_courier;
  if not found then raise exception 'not_found'; end if;

  insert into public.claims (job_id, order_id, store_id, reporter_type, reporter_user_id, reporter_name, reporter_phone,
                             category, description)
  values (p_job_id, v_job.order_id, v_job.store_id, 'courier', (select auth.uid()), v_c.full_name, v_c.phone,
          p_category, left(trim(coalesce(p_description, '')), 2000))
  returning reference into v_ref;

  insert into public.delivery_events (job_id, type, message, actor_id)
  values (p_job_id, 'issue_reported', p_category, (select auth.uid()));
  return v_ref;
end $$;

create function public.apply_platform_courier(p_payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := left(trim(coalesce(p_payload ->> 'full_name', '')), 120);
  v_phone text := public.normalize_phone(p_payload ->> 'phone');
  v_doc text := nullif(p_payload ->> 'id_document_path', '');
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_active_user() then raise exception 'account_suspended'; end if;
  if exists (select 1 from public.couriers where user_id = v_uid) then raise exception 'already_courier'; end if;
  if char_length(v_name) < 2 then raise exception 'invalid_name'; end if;
  if not public.is_valid_phone(v_phone) then raise exception 'invalid_phone'; end if;
  if v_doc is not null and v_doc not like (v_uid::text || '/%') then raise exception 'invalid_document_path'; end if;

  insert into public.couriers (user_id, kind, full_name, phone, vehicle_type, vehicle_plate, zone, zone_lat, zone_lng,
                               zone_radius_km, account_status, id_document_path)
  values (
    v_uid, 'platform', v_name, v_phone, nullif(p_payload ->> 'vehicle_type', ''),
    nullif(left(trim(coalesce(p_payload ->> 'vehicle_plate', '')), 30), ''),
    nullif(left(trim(coalesce(p_payload ->> 'zone', '')), 120), ''),
    nullif(p_payload ->> 'zone_lat', '')::double precision,
    nullif(p_payload ->> 'zone_lng', '')::double precision,
    nullif(p_payload ->> 'zone_radius_km', '')::numeric,
    'pending_review', v_doc
  )
  returning id into v_id;
  perform public.log_activity('courier.applied', null, 'courier', v_id::text);
  return v_id;
end $$;

create function public.courier_update_profile(p_payload jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_c public.couriers%rowtype;
  v_phone text := public.normalize_phone(p_payload ->> 'phone');
  v_doc text := nullif(p_payload ->> 'id_document_path', '');
begin
  select * into v_c from public.couriers where id = public.my_courier_id() for update;
  if not found then raise exception 'not_a_courier'; end if;
  if not public.is_valid_phone(v_phone) then raise exception 'invalid_phone'; end if;
  if v_doc is not null and v_doc not like (v_uid::text || '/%') then raise exception 'invalid_document_path'; end if;

  update public.couriers set
    phone = v_phone,
    vehicle_type = nullif(p_payload ->> 'vehicle_type', ''),
    vehicle_plate = nullif(left(trim(coalesce(p_payload ->> 'vehicle_plate', '')), 30), ''),
    zone = nullif(left(trim(coalesce(p_payload ->> 'zone', '')), 120), ''),
    id_document_path = coalesce(v_doc, id_document_path),
    account_status = case
      when v_c.kind = 'platform' and v_c.account_status = 'rejected' and coalesce((p_payload ->> 'resubmit')::boolean, false)
        then 'pending_review'::public.courier_account_status
      else account_status end
  where id = v_c.id;
end $$;

-- ---------------------------------------------------------------------
-- Livraison ponctuelle (sans boutique)
-- ---------------------------------------------------------------------
create function public.quote_delivery(
  p_pickup_lat double precision, p_pickup_lng double precision,
  p_dropoff_lat double precision, p_dropoff_lng double precision,
  p_package_type text default null
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  r public.pricing_rules%rowtype;
  v_dist numeric;
  v_sur numeric;
  v_raw numeric;
  v_price numeric;
begin
  if not public.setting_bool('on_demand.enabled', true) then raise exception 'on_demand_disabled'; end if;
  select * into r from public.pricing_rules where is_active limit 1;
  if not found then raise exception 'pricing_unavailable'; end if;
  if p_pickup_lat is null or p_pickup_lng is null or p_dropoff_lat is null or p_dropoff_lng is null
     or p_pickup_lat not between -90 and 90 or p_dropoff_lat not between -90 and 90
     or p_pickup_lng not between -180 and 180 or p_dropoff_lng not between -180 and 180 then
    raise exception 'invalid_coordinates';
  end if;

  v_dist := round(public.haversine_km(p_pickup_lat, p_pickup_lng, p_dropoff_lat, p_dropoff_lng)::numeric, 2);
  if r.max_distance_km is not null and v_dist > r.max_distance_km then raise exception 'distance_too_long'; end if;
  v_sur := coalesce(nullif(r.package_surcharges ->> coalesce(p_package_type, ''), '')::numeric, 0);
  v_raw := greatest(r.min_fee, r.base_fee + r.per_km_fee * v_dist) + v_sur;
  v_price := ceil(v_raw / r.rounding) * r.rounding;

  return jsonb_build_object(
    'distance_km', v_dist,
    'distance_method', 'straight_line',
    'price', v_price,
    'currency', r.currency,
    'rule', r.name,
    'breakdown', jsonb_build_object(
      'base_fee', r.base_fee, 'per_km_fee', r.per_km_fee, 'distance_fee', round(r.per_km_fee * v_dist, 2),
      'min_fee', r.min_fee, 'surcharge', v_sur, 'rounding', r.rounding
    )
  );
end $$;

create function public.create_on_demand_delivery(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_sender_name text := left(trim(coalesce(p_payload #>> '{sender,name}', '')), 120);
  v_sender_phone text := public.normalize_phone(p_payload #>> '{sender,phone}');
  v_recipient_name text := left(trim(coalesce(p_payload #>> '{recipient,name}', '')), 120);
  v_recipient_phone text := public.normalize_phone(p_payload #>> '{recipient,phone}');
  v_pickup_address text := left(trim(coalesce(p_payload #>> '{pickup,address}', '')), 300);
  v_dropoff_address text := left(trim(coalesce(p_payload #>> '{dropoff,address}', '')), 300);
  v_plat double precision := nullif(p_payload #>> '{pickup,lat}', '')::double precision;
  v_plng double precision := nullif(p_payload #>> '{pickup,lng}', '')::double precision;
  v_dlat double precision := nullif(p_payload #>> '{dropoff,lat}', '')::double precision;
  v_dlng double precision := nullif(p_payload #>> '{dropoff,lng}', '')::double precision;
  v_package text := nullif(p_payload ->> 'package_type', '');
  v_method public.payment_method := coalesce(nullif(p_payload ->> 'payment_method', ''), 'cash_on_delivery')::public.payment_method;
  v_payer text := coalesce(nullif(p_payload ->> 'payer', ''), 'sender');
  v_collect numeric := greatest(coalesce(nullif(p_payload ->> 'collect_amount', '')::numeric, 0), 0);
  v_expected numeric := nullif(p_payload ->> 'expected_price', '')::numeric;
  v_quote jsonb;
  v_job uuid;
  v_ref text;
  v_token text;
begin
  if char_length(v_sender_name) < 2 or char_length(v_recipient_name) < 2 then raise exception 'invalid_name'; end if;
  if not public.is_valid_phone(v_sender_phone) or not public.is_valid_phone(v_recipient_phone) then
    raise exception 'invalid_phone';
  end if;
  if char_length(v_pickup_address) < 3 or char_length(v_dropoff_address) < 3 then raise exception 'address_required'; end if;
  if v_package is not null and v_package not in ('document', 'small', 'medium', 'large', 'fragile', 'food') then
    raise exception 'invalid_package_type';
  end if;
  if v_method not in ('cash_on_delivery', 'orange_money', 'mtn_momo', 'manual') then raise exception 'invalid_payment_method'; end if;
  if v_payer not in ('sender', 'recipient') then raise exception 'invalid_payer'; end if;
  if v_collect > 5000000 then raise exception 'invalid_amount'; end if;

  if (select count(*) from public.delivery_jobs
      where requester_phone = v_sender_phone and created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.delivery_jobs
         where source = 'on_demand' and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'too_many_requests';
  end if;

  v_quote := public.quote_delivery(v_plat, v_plng, v_dlat, v_dlng, v_package);
  if v_expected is not null and v_expected <> (v_quote ->> 'price')::numeric then raise exception 'price_changed'; end if;

  insert into public.delivery_jobs (
    source, requester_user_id, requester_name, requester_phone,
    pickup_name, pickup_phone, pickup_address, pickup_lat, pickup_lng,
    dropoff_name, dropoff_phone, dropoff_address, dropoff_lat, dropoff_lng,
    package_type, package_description, instructions, distance_km, price, collect_amount, currency,
    payment_method, payer, share_courier_phone
  ) values (
    'on_demand', (select auth.uid()), v_sender_name, v_sender_phone,
    v_sender_name, v_sender_phone, v_pickup_address, v_plat, v_plng,
    v_recipient_name, v_recipient_phone, v_dropoff_address, v_dlat, v_dlng,
    v_package,
    nullif(left(trim(coalesce(p_payload ->> 'description', '')), 500), ''),
    nullif(left(trim(coalesce(p_payload ->> 'instructions', '')), 1000), ''),
    (v_quote ->> 'distance_km')::numeric, (v_quote ->> 'price')::numeric, v_collect, v_quote ->> 'currency',
    v_method, v_payer, true
  )
  returning id, reference, tracking_token into v_job, v_ref, v_token;

  perform public.log_activity('on_demand.created', null, 'delivery_job', v_job::text, jsonb_build_object('reference', v_ref));
  return jsonb_build_object('id', v_job, 'reference', v_ref, 'tracking_token', v_token,
                            'price', v_quote -> 'price', 'currency', v_quote -> 'currency');
end $$;

-- ---------------------------------------------------------------------
-- Suivi public par jeton (aucun compte requis)
-- Données minimales : pas de numéro du destinataire ni de l'expéditeur.
-- ---------------------------------------------------------------------
create function public.get_tracking(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  j public.delivery_jobs%rowtype;
  s public.stores%rowtype;
  c public.couriers%rowtype;
  v_stale integer := public.setting_int('location.stale_after_s', 120);
  v_live boolean;
  v_pos jsonb;
  v_courier jsonb;
  v_events jsonb;
begin
  if p_token is null or char_length(p_token) <> 32 then return null; end if;
  select * into j from public.delivery_jobs where tracking_token = p_token;
  if not found then return null; end if;
  if j.store_id is not null then select * into s from public.stores where id = j.store_id; end if;
  if j.courier_id is not null then select * into c from public.couriers where id = j.courier_id; end if;

  v_live := j.tracking_active and j.status in ('accepted', 'picked_up', 'in_transit');

  if c.id is not null and j.status in ('accepted', 'picked_up', 'in_transit', 'delivered') then
    v_courier := jsonb_build_object(
      'first_name', split_part(c.full_name, ' ', 1),
      'vehicle_type', c.vehicle_type,
      'phone', case when j.share_courier_phone and v_live then c.phone end
    );
  end if;

  if v_live and c.last_lat is not null and c.last_location_at is not null then
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
    'source', j.source,
    'store', case when s.id is not null then jsonb_build_object(
      'name', s.name, 'slug', case when s.is_published then s.slug end,
      'logo_path', s.logo_path, 'phone', coalesce(s.whatsapp, s.phone)) end,
    'order_reference', (select o.reference from public.orders o where o.id = j.order_id),
    'pickup', jsonb_build_object('label', coalesce(j.pickup_name, 'Point de collecte'), 'address', j.pickup_address,
                                 'lat', j.pickup_lat, 'lng', j.pickup_lng),
    'dropoff', jsonb_build_object('label', split_part(j.dropoff_name, ' ', 1), 'address', j.dropoff_address,
                                  'lat', j.dropoff_lat, 'lng', j.dropoff_lng),
    'package_type', j.package_type,
    'distance_km', j.distance_km,
    'collect_amount', j.collect_amount,
    'price', case when j.source = 'on_demand' then j.price end,
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
    'can_cancel', j.source = 'on_demand' and j.status in ('pending', 'offered'),
    'server_time', now()
  );
end $$;

create function public.confirm_delivery_receipt(p_token text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  update public.delivery_jobs set recipient_confirmed_at = now()
  where tracking_token = p_token and status = 'delivered' and recipient_confirmed_at is null
  returning id into v_id;
  if v_id is null then return false; end if;
  insert into public.delivery_events (job_id, type) values (v_id, 'recipient_confirmed');
  return true;
end $$;

create function public.cancel_on_demand_by_token(p_token text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  select id into v_id from public.delivery_jobs
  where tracking_token = p_token and source = 'on_demand' and status in ('pending', 'offered')
  for update;
  if v_id is null then return false; end if;
  update public.delivery_assignments set status = 'revoked', responded_at = now()
  where job_id = v_id and status = 'offered';
  update public.delivery_jobs set status = 'cancelled', courier_id = null, cancel_reason = 'Annulée par le demandeur'
  where id = v_id;
  return true;
end $$;

create function public.submit_tracking_claim(
  p_token text, p_category text, p_description text, p_name text, p_phone text
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_job public.delivery_jobs%rowtype;
  v_ref text;
  v_phone text := public.normalize_phone(p_phone);
begin
  select * into v_job from public.delivery_jobs where tracking_token = p_token;
  if not found then raise exception 'not_found'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'invalid_name'; end if;
  if not public.is_valid_phone(v_phone) then raise exception 'invalid_phone'; end if;
  if (select count(*) from public.claims where job_id = v_job.id and created_at > now() - interval '1 day') >= 3 then
    raise exception 'too_many_requests';
  end if;
  insert into public.claims (job_id, order_id, store_id, reporter_type, reporter_name, reporter_phone, category, description)
  values (v_job.id, v_job.order_id, v_job.store_id, 'customer', left(trim(p_name), 120), v_phone, p_category,
          left(trim(coalesce(p_description, '')), 2000))
  returning reference into v_ref;
  return v_ref;
end $$;
