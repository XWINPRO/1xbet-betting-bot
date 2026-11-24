-- =====================================================================
-- Relais · 005 — Administration, paiements, statistiques, stockage,
-- temps réel, maintenance planifiée et droits d'exécution.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Administration de la plateforme
-- ---------------------------------------------------------------------
create function public.admin_review_courier(p_courier_id uuid, p_decision text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_c public.couriers%rowtype;
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_c from public.couriers where id = p_courier_id for update;
  if not found then raise exception 'not_found'; end if;

  if p_decision = 'approve' then
    if v_c.account_status not in ('pending_review', 'rejected') then raise exception 'invalid_transition'; end if;
    update public.couriers set account_status = 'active', review_note = nullif(trim(coalesce(p_note, '')), '') where id = v_c.id;
  elsif p_decision = 'reject' then
    if v_c.account_status <> 'pending_review' then raise exception 'invalid_transition'; end if;
    update public.couriers set account_status = 'rejected', review_note = nullif(trim(coalesce(p_note, '')), '') where id = v_c.id;
  elsif p_decision = 'suspend' then
    if v_c.account_status <> 'active' then raise exception 'invalid_transition'; end if;
    update public.couriers set account_status = 'suspended', availability = 'unavailable',
      review_note = nullif(trim(coalesce(p_note, '')), '') where id = v_c.id;
    update public.delivery_assignments set status = 'revoked', responded_at = now()
    where courier_id = v_c.id and status = 'offered';
    update public.delivery_jobs set status = 'pending', courier_id = null
    where courier_id = v_c.id and status = 'offered';
  elsif p_decision = 'reactivate' then
    if v_c.account_status <> 'suspended' then raise exception 'invalid_transition'; end if;
    update public.couriers set account_status = 'active', review_note = nullif(trim(coalesce(p_note, '')), '') where id = v_c.id;
  else
    raise exception 'invalid_decision';
  end if;

  perform public.log_activity('admin.courier_' || p_decision, null, 'courier', v_c.id::text,
    jsonb_build_object('note', p_note, 'name', v_c.full_name));
end $$;

create function public.admin_set_user_suspension(p_user_id uuid, p_suspended boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_user_id = (select auth.uid()) then raise exception 'cannot_target_self'; end if;
  update public.profiles
  set is_suspended = p_suspended,
      suspended_reason = case when p_suspended then nullif(trim(coalesce(p_reason, '')), '') end
  where id = p_user_id;
  if not found then raise exception 'not_found'; end if;
  if p_suspended then
    update public.couriers set availability = 'unavailable' where user_id = p_user_id;
  end if;
  perform public.log_activity(case when p_suspended then 'admin.user_suspended' else 'admin.user_reactivated' end,
    null, 'profile', p_user_id::text, jsonb_build_object('reason', p_reason));
end $$;

create function public.admin_set_store_status(p_store_id uuid, p_status public.store_status, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.stores
  set status = p_status,
      status_reason = case when p_status = 'suspended' then nullif(trim(coalesce(p_reason, '')), '') end
  where id = p_store_id;
  if not found then raise exception 'not_found'; end if;
  perform public.log_activity('admin.store_' || p_status::text, p_store_id, 'store', p_store_id::text,
    jsonb_build_object('reason', p_reason));
end $$;

create function public.admin_set_platform_admin(p_user_id uuid, p_value boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_user_id = (select auth.uid()) and not p_value then raise exception 'cannot_target_self'; end if;
  update public.profiles set is_platform_admin = p_value where id = p_user_id;
  if not found then raise exception 'not_found'; end if;
  perform public.log_activity(case when p_value then 'admin.granted' else 'admin.revoked' end,
    null, 'profile', p_user_id::text);
end $$;

create function public.admin_update_setting(p_key text, p_value jsonb) returns void
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
  if p_key like 'location.%' and (p_value #>> '{}')::numeric < 3 then raise exception 'invalid_setting_value'; end if;
  update public.platform_settings set value = p_value, updated_by = (select auth.uid()) where key = p_key;
  perform public.log_activity('admin.setting_updated', null, 'setting', p_key,
    jsonb_build_object('from', v_old, 'to', p_value));
end $$;

-- ---------------------------------------------------------------------
-- Paiements manuels (aucune transaction de prestataire n'est simulée)
-- ---------------------------------------------------------------------
create function public.record_payment(p_payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_job public.delivery_jobs%rowtype;
  v_order_id uuid := public.try_uuid(p_payload ->> 'order_id');
  v_job_id uuid := public.try_uuid(p_payload ->> 'job_id');
  v_amount numeric := nullif(p_payload ->> 'amount', '')::numeric;
  v_method public.payment_method := coalesce(nullif(p_payload ->> 'method', ''), 'manual')::public.payment_method;
  v_status public.transaction_status := coalesce(nullif(p_payload ->> 'status', ''), 'confirmed')::public.transaction_status;
  v_id uuid;
  v_store uuid;
  v_currency text;
begin
  if v_amount is null or v_amount <= 0 or v_amount > 100000000 then raise exception 'invalid_amount'; end if;
  if v_status not in ('pending', 'confirmed') then raise exception 'invalid_status'; end if;

  if v_order_id is not null then
    select * into v_order from public.orders where id = v_order_id;
    if not found then raise exception 'not_found'; end if;
    if not (public.has_store_permission(v_order.store_id, 'orders.edit') or public.is_platform_admin()) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    v_store := v_order.store_id;
    v_currency := v_order.currency;
  elsif v_job_id is not null then
    select * into v_job from public.delivery_jobs where id = v_job_id;
    if not found then raise exception 'not_found'; end if;
    if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
    v_store := v_job.store_id;
    v_currency := v_job.currency;
  else
    raise exception 'target_required';
  end if;

  insert into public.transactions (store_id, order_id, job_id, amount, currency, method, provider, provider_reference,
                                   status, notes, recorded_by, confirmed_by, confirmed_at)
  values (v_store, v_order_id, case when v_order_id is null then v_job_id end, v_amount, v_currency, v_method, 'manual',
          nullif(left(trim(coalesce(p_payload ->> 'provider_reference', '')), 120), ''), v_status,
          nullif(left(trim(coalesce(p_payload ->> 'notes', '')), 500), ''),
          (select auth.uid()),
          case when v_status = 'confirmed' then (select auth.uid()) end,
          case when v_status = 'confirmed' then now() end)
  returning id into v_id;

  perform public._refresh_payment_status(v_order_id, case when v_order_id is null then v_job_id end);
  perform public.log_activity('payment.recorded', v_store, 'transaction', v_id::text,
    jsonb_build_object('amount', v_amount, 'method', v_method, 'status', v_status));
  return v_id;
end $$;

create function public.confirm_transaction(p_tx_id uuid, p_status public.transaction_status) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_tx public.transactions%rowtype;
begin
  select * into v_tx from public.transactions where id = p_tx_id for update;
  if not found then raise exception 'not_found'; end if;
  if not (public.is_platform_admin()
          or (v_tx.store_id is not null and v_tx.order_id is not null
              and public.has_store_permission(v_tx.store_id, 'orders.edit'))) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_status = 'pending' then raise exception 'invalid_status'; end if;
  if v_tx.status = p_status then return; end if;
  if v_tx.status in ('failed', 'cancelled', 'refunded') then raise exception 'transaction_closed'; end if;

  update public.transactions set
    status = p_status,
    confirmed_by = case when p_status = 'confirmed' then (select auth.uid()) else confirmed_by end,
    confirmed_at = case when p_status = 'confirmed' then now() else confirmed_at end
  where id = p_tx_id;

  perform public._refresh_payment_status(v_tx.order_id, case when v_tx.order_id is null then v_tx.job_id end);
  perform public.log_activity('payment.' || p_status::text, v_tx.store_id, 'transaction', p_tx_id::text,
    jsonb_build_object('amount', v_tx.amount));
end $$;

-- ---------------------------------------------------------------------
-- Statistiques (toutes calculées depuis les données réelles)
-- ---------------------------------------------------------------------
create function public.store_dashboard_stats(p_store_id uuid, p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_rev boolean;
  v_max integer;
  v_result jsonb;
begin
  if not (public.is_store_member(p_store_id) or public.is_platform_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_rev := public.has_store_permission(p_store_id, 'stats.view') or public.is_platform_admin();
  select courier_max_active_jobs into v_max from public.stores where id = p_store_id;

  select jsonb_build_object(
    'can_view_revenue', v_rev,
    'revenue', case when v_rev then (
      select coalesce(sum(o.total), 0) from public.orders o
      where o.store_id = p_store_id and o.status = 'delivered' and o.delivered_at >= p_from and o.delivered_at < p_to) end,
    'collected', case when v_rev then (
      select coalesce(sum(t.amount), 0) from public.transactions t
      where t.store_id = p_store_id and t.status = 'confirmed' and t.confirmed_at >= p_from and t.confirmed_at < p_to) end,
    'pending_cash', case when v_rev then (
      select coalesce(sum(t.amount), 0) from public.transactions t
      where t.store_id = p_store_id and t.status = 'pending') end,
    'avg_order_value', case when v_rev then (
      select round(avg(o.total), 0) from public.orders o
      where o.store_id = p_store_id and o.status <> 'cancelled' and o.created_at >= p_from and o.created_at < p_to) end,
    'orders_count', (
      select count(*) from public.orders o
      where o.store_id = p_store_id and o.created_at >= p_from and o.created_at < p_to),
    'cancelled_count', (
      select count(*) from public.orders o
      where o.store_id = p_store_id and o.status = 'cancelled' and o.cancelled_at >= p_from and o.cancelled_at < p_to),
    'pending_orders', (
      select count(*) from public.orders o
      where o.store_id = p_store_id and o.status in ('new', 'confirmed', 'preparing', 'ready_for_pickup')),
    'new_orders', (
      select count(*) from public.orders o where o.store_id = p_store_id and o.status = 'new'),
    'active_deliveries', (
      select count(*) from public.delivery_jobs j
      where j.store_id = p_store_id and j.status in ('offered', 'accepted', 'picked_up', 'in_transit')),
    'unassigned_deliveries', (
      select count(*) from public.delivery_jobs j where j.store_id = p_store_id and j.status = 'pending'),
    'delivered_count', (
      select count(*) from public.delivery_jobs j
      where j.store_id = p_store_id and j.status = 'delivered' and j.delivered_at >= p_from and j.delivered_at < p_to),
    'failed_count', (
      select count(*) from public.delivery_jobs j
      where j.store_id = p_store_id and j.status = 'failed' and j.failed_at >= p_from and j.failed_at < p_to),
    'available_couriers', (
      select count(*) from public.courier_store_memberships m
      join public.couriers c on c.id = m.courier_id
      where m.store_id = p_store_id and m.status = 'active'
        and public.courier_effective_status(c.account_status, c.availability, c.last_seen_at,
                                            public.courier_active_jobs(c.id), v_max) = 'available'),
    'couriers_total', (
      select count(*) from public.courier_store_memberships m where m.store_id = p_store_id and m.status = 'active')
  ) into v_result;
  return v_result;
end $$;

create function public.store_daily_series(p_store_id uuid, p_from date, p_to date, p_tz text default 'Africa/Douala')
returns table (bucket_day date, orders_count integer, revenue_amount numeric, delivered_count integer, failed_count integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_start timestamptz;
  v_end timestamptz;
begin
  if not (public.has_store_permission(p_store_id, 'stats.view') or public.is_platform_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_to < p_from or p_to - p_from > 366 then raise exception 'invalid_range'; end if;
  v_start := p_from::timestamp at time zone p_tz;
  v_end := (p_to + 1)::timestamp at time zone p_tz;

  return query
  with days as (
    select g::date as d from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') g
  ),
  o as (
    select (x.created_at at time zone p_tz)::date as d, count(*)::integer as n
    from public.orders x
    where x.store_id = p_store_id and x.created_at >= v_start and x.created_at < v_end
    group by 1
  ),
  rv as (
    select (x.delivered_at at time zone p_tz)::date as d, sum(x.total) as s
    from public.orders x
    where x.store_id = p_store_id and x.status = 'delivered' and x.delivered_at >= v_start and x.delivered_at < v_end
    group by 1
  ),
  dj as (
    select (x.delivered_at at time zone p_tz)::date as d, count(*)::integer as n
    from public.delivery_jobs x
    where x.store_id = p_store_id and x.status = 'delivered' and x.delivered_at >= v_start and x.delivered_at < v_end
    group by 1
  ),
  fj as (
    select (x.failed_at at time zone p_tz)::date as d, count(*)::integer as n
    from public.delivery_jobs x
    where x.store_id = p_store_id and x.status = 'failed' and x.failed_at >= v_start and x.failed_at < v_end
    group by 1
  )
  select days.d, coalesce(o.n, 0), coalesce(rv.s, 0)::numeric, coalesce(dj.n, 0), coalesce(fj.n, 0)
  from days
  left join o on o.d = days.d
  left join rv on rv.d = days.d
  left join dj on dj.d = days.d
  left join fj on fj.d = days.d
  order by days.d;
end $$;

create function public.store_top_products(p_store_id uuid, p_from timestamptz, p_to timestamptz, p_limit integer default 5)
returns table (product_name text, quantity_sold bigint, revenue_amount numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.has_store_permission(p_store_id, 'stats.view') or public.is_platform_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select i.name, sum(i.quantity)::bigint, sum(i.line_total)::numeric
  from public.order_items i
  join public.orders o on o.id = i.order_id
  where o.store_id = p_store_id and o.status <> 'cancelled' and o.created_at >= p_from and o.created_at < p_to
  group by i.name
  order by 3 desc, 2 desc
  limit least(greatest(p_limit, 1), 50);
end $$;

create function public.store_courier_performance(p_store_id uuid, p_from timestamptz, p_to timestamptz)
returns table (courier_id uuid, courier_name text, delivered_count integer, failed_count integer, avg_delivery_minutes numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.has_store_permission(p_store_id, 'stats.view') or public.has_store_permission(p_store_id, 'couriers.assign')
          or public.is_platform_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select c.id, c.full_name,
    (count(*) filter (where j.status = 'delivered'))::integer,
    (count(*) filter (where j.status = 'failed'))::integer,
    round(avg(extract(epoch from (j.delivered_at - j.accepted_at)) / 60.0)
      filter (where j.status = 'delivered' and j.accepted_at is not null)::numeric, 0)
  from public.delivery_jobs j
  join public.couriers c on c.id = j.courier_id
  where j.store_id = p_store_id and j.status in ('delivered', 'failed')
    and coalesce(j.delivered_at, j.failed_at) >= p_from and coalesce(j.delivered_at, j.failed_at) < p_to
  group by c.id, c.full_name
  order by 3 desc;
end $$;

create function public.admin_overview_stats(p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_result jsonb;
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select jsonb_build_object(
    'stores_total', (select count(*) from public.stores),
    'stores_published', (select count(*) from public.stores where is_published and status = 'active'),
    'stores_suspended', (select count(*) from public.stores where status = 'suspended'),
    'users_total', (select count(*) from public.profiles),
    'users_suspended', (select count(*) from public.profiles where is_suspended),
    'platform_couriers_active', (select count(*) from public.couriers where kind = 'platform' and account_status = 'active'),
    'courier_applications', (select count(*) from public.couriers where account_status = 'pending_review'),
    'private_couriers', (select count(*) from public.couriers where kind = 'private'),
    'orders_count', (select count(*) from public.orders where created_at >= p_from and created_at < p_to),
    'gmv', (select coalesce(sum(total), 0) from public.orders
            where status = 'delivered' and delivered_at >= p_from and delivered_at < p_to),
    'on_demand_count', (select count(*) from public.delivery_jobs
                        where source = 'on_demand' and created_at >= p_from and created_at < p_to),
    'on_demand_revenue', (select coalesce(sum(price), 0) from public.delivery_jobs
                          where source = 'on_demand' and status = 'delivered' and delivered_at >= p_from and delivered_at < p_to),
    'pending_on_demand', (select count(*) from public.delivery_jobs where source = 'on_demand' and status = 'pending'),
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

create function public.admin_daily_series(p_from date, p_to date, p_tz text default 'Africa/Douala')
returns table (bucket_day date, orders_count integer, on_demand_count integer, delivered_count integer, failed_count integer)
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
  od as (
    select (x.created_at at time zone p_tz)::date as d, count(*)::integer as n
    from public.delivery_jobs x
    where x.source = 'on_demand' and x.created_at >= v_start and x.created_at < v_end group by 1
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
  select days.d, coalesce(o.n, 0), coalesce(od.n, 0), coalesce(dj.n, 0), coalesce(fj.n, 0)
  from days
  left join o on o.d = days.d
  left join od on od.d = days.d
  left join dj on dj.d = days.d
  left join fj on fj.d = days.d
  order by days.d;
end $$;

-- ---------------------------------------------------------------------
-- Maintenance planifiée : disponibilité fiable et rétention GPS
-- ---------------------------------------------------------------------
create function public.maintain_courier_states() returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- Un livreur « disponible » qui n'envoie plus aucun signal repasse indisponible.
  update public.couriers c set
    availability = 'unavailable', availability_changed_at = now(),
    last_lat = null, last_lng = null, last_accuracy = null, last_heading = null, last_speed = null, last_location_at = null
  where c.availability = 'available'
    and (c.last_seen_at is null
         or c.last_seen_at < now() - make_interval(secs => public.setting_int('courier.auto_unavailable_after_s', 3600)))
    and not exists (
      select 1 from public.delivery_jobs j
      where j.courier_id = c.id and j.status in ('accepted', 'picked_up', 'in_transit')
    );
end $$;

create function public.purge_location_history() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.courier_locations
  where received_at < now() - make_interval(days => public.setting_int('tracking.retention_days', 30));

  update public.couriers c set
    last_lat = null, last_lng = null, last_accuracy = null, last_heading = null, last_speed = null, last_location_at = null
  where c.last_location_at < now() - interval '12 hours'
    and not exists (
      select 1 from public.delivery_jobs j
      where j.courier_id = c.id and j.status in ('accepted', 'picked_up', 'in_transit')
    );
end $$;

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.schedule('relais-maintain-couriers', '*/5 * * * *', 'select public.maintain_courier_states()');
select cron.schedule('relais-purge-locations', '17 3 * * *', 'select public.purge_location_history()');

-- ---------------------------------------------------------------------
-- Stockage des fichiers
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('store-assets', 'store-assets', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('delivery-proofs', 'delivery-proofs', false, 8388608, array['image/jpeg', 'image/png', 'image/webp']),
  ('courier-documents', 'courier-documents', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- store-assets/<store_id>/… : logos, bannières, photos produits (lecture publique)
create policy store_assets_select on storage.objects for select to authenticated
  using (bucket_id = 'store-assets' and public.is_store_member(public.try_uuid((storage.foldername(name))[1])));
create policy store_assets_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'store-assets'
              and public.has_store_permission(public.try_uuid((storage.foldername(name))[1]), 'products.manage'));
create policy store_assets_update on storage.objects for update to authenticated
  using (bucket_id = 'store-assets'
         and public.has_store_permission(public.try_uuid((storage.foldername(name))[1]), 'products.manage'))
  with check (bucket_id = 'store-assets'
              and public.has_store_permission(public.try_uuid((storage.foldername(name))[1]), 'products.manage'));
create policy store_assets_delete on storage.objects for delete to authenticated
  using (bucket_id = 'store-assets'
         and public.has_store_permission(public.try_uuid((storage.foldername(name))[1]), 'products.manage'));

-- delivery-proofs/<job_id>/… : photo de preuve déposée par le livreur assigné
create policy delivery_proofs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'delivery-proofs' and exists (
    select 1 from public.delivery_jobs j
    where j.id = public.try_uuid((storage.foldername(name))[1])
      and j.courier_id = public.my_courier_id()
      and j.status in ('accepted', 'picked_up', 'in_transit')
  ));
create policy delivery_proofs_select on storage.objects for select to authenticated
  using (bucket_id = 'delivery-proofs' and exists (
    select 1 from public.delivery_jobs j where j.id = public.try_uuid((storage.foldername(name))[1])
  ));

-- courier-documents/<user_id>/… : pièces justificatives des candidats livreurs
create policy courier_documents_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'courier-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy courier_documents_select on storage.objects for select to authenticated
  using (bucket_id = 'courier-documents'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_platform_admin()));

-- ---------------------------------------------------------------------
-- Temps réel (postgres_changes, filtré par RLS pour chaque abonné)
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table
  public.delivery_jobs, public.couriers, public.orders, public.delivery_assignments;

-- ---------------------------------------------------------------------
-- Droits d'exécution : rien par défaut, puis liste explicite.
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

-- Fonctions utilisées dans les politiques RLS / stockage
grant execute on function
  public.is_platform_admin(), public.is_active_user(), public.is_store_member(uuid), public.is_store_owner(uuid),
  public.has_store_permission(uuid, text), public.my_courier_id(), public.is_store_courier_of(uuid),
  public.shares_store_with(uuid), public.try_uuid(text)
to anon, authenticated;

-- RPC publiques (sans compte)
grant execute on function
  public.place_storefront_order(text, jsonb),
  public.get_tracking(text),
  public.confirm_delivery_receipt(text),
  public.cancel_on_demand_by_token(text),
  public.submit_tracking_claim(text, text, text, text, text),
  public.quote_delivery(double precision, double precision, double precision, double precision, text),
  public.create_on_demand_delivery(jsonb),
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
  public.admin_courier_board(public.courier_kind),
  public.store_add_courier(uuid, jsonb),
  public.store_create_courier_invite(uuid, uuid),
  public.store_update_courier(uuid, uuid, jsonb),
  public.store_set_courier_access(uuid, uuid, boolean),
  public.courier_settings(),
  public.courier_set_availability(boolean),
  public.courier_heartbeat(),
  public.report_courier_location(double precision, double precision, double precision, double precision, double precision, timestamptz),
  public.courier_respond_offer(uuid, boolean, text),
  public.courier_open_jobs(),
  public.courier_claim_job(uuid),
  public.courier_update_job(uuid, public.job_status, jsonb),
  public.courier_report_issue(uuid, text, text),
  public.apply_platform_courier(jsonb),
  public.courier_update_profile(jsonb),
  public.admin_review_courier(uuid, text, text),
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
