-- =====================================================================
-- Relais · 003 — RPC commerce : boutiques, commandes, stock, équipe
-- Toutes les fonctions sont SECURITY DEFINER et vérifient explicitement
-- les droits de l'appelant. Les erreurs métier sont levées avec un code
-- court (ex. 'forbidden', 'slug_taken') traduit côté application.
-- =====================================================================

create function public.order_transition_allowed(p_from public.order_status, p_to public.order_status)
returns boolean language sql immutable set search_path = '' as $$
  select case p_from
    when 'new' then p_to in ('confirmed', 'preparing', 'ready_for_pickup', 'cancelled', 'delivered')
    when 'confirmed' then p_to in ('preparing', 'ready_for_pickup', 'cancelled', 'delivered')
    when 'preparing' then p_to in ('ready_for_pickup', 'cancelled', 'delivered')
    when 'ready_for_pickup' then p_to in ('preparing', 'handed_to_courier', 'cancelled', 'delivered')
    when 'handed_to_courier' then p_to in ('in_transit', 'delivered', 'delivery_failed')
    when 'in_transit' then p_to in ('delivered', 'delivery_failed')
    when 'delivery_failed' then p_to in ('ready_for_pickup', 'cancelled', 'delivered')
    else false
  end
$$;

create function public.is_valid_phone(p text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(public.normalize_phone(p) ~ '^\+?[0-9]{8,15}$', false)
$$;

-- ---------------------------------------------------------------------
-- Création de boutique (organisation + boutique + propriétaire)
-- ---------------------------------------------------------------------
create function public.create_store(p_payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := trim(coalesce(p_payload ->> 'name', ''));
  v_slug text := lower(trim(coalesce(p_payload ->> 'slug', '')));
  v_org uuid;
  v_store uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_active_user() then raise exception 'account_suspended'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 then raise exception 'invalid_name'; end if;
  if (select count(*) from public.store_members where user_id = v_uid and role = 'owner') >= 5 then
    raise exception 'store_limit_reached';
  end if;
  if exists (select 1 from public.stores where slug = v_slug) then raise exception 'slug_taken'; end if;

  insert into public.organizations (name, owner_id) values (v_name, v_uid) returning id into v_org;

  insert into public.stores (organization_id, name, slug, category, phone, whatsapp, city, address, default_delivery_fee)
  values (
    v_org, v_name, v_slug,
    nullif(trim(coalesce(p_payload ->> 'category', '')), ''),
    public.normalize_phone(p_payload ->> 'phone'),
    public.normalize_phone(p_payload ->> 'whatsapp'),
    nullif(trim(coalesce(p_payload ->> 'city', '')), ''),
    nullif(trim(coalesce(p_payload ->> 'address', '')), ''),
    greatest(coalesce(nullif(p_payload ->> 'default_delivery_fee', '')::numeric, 0), 0)
  )
  returning id into v_store;

  insert into public.store_members (store_id, user_id, role) values (v_store, v_uid, 'owner');
  perform public.log_activity('store.created', v_store, 'store', v_store::text, jsonb_build_object('slug', v_slug));
  return v_store;
exception
  when unique_violation then raise exception 'slug_taken';
  when check_violation then raise exception 'invalid_store_data';
end $$;

-- ---------------------------------------------------------------------
-- Outils internes : clients, lignes de commande, stock, paiements
-- ---------------------------------------------------------------------
create function public._upsert_customer(
  p_store uuid, p_name text, p_phone text, p_address text, p_lat double precision, p_lng double precision
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  insert into public.customers (store_id, full_name, phone, whatsapp, address, lat, lng)
  values (p_store, p_name, p_phone, p_phone, p_address, p_lat, p_lng)
  on conflict (store_id, phone) do update set
    full_name = excluded.full_name,
    address = coalesce(excluded.address, public.customers.address),
    lat = coalesce(excluded.lat, public.customers.lat),
    lng = coalesce(excluded.lng, public.customers.lng)
  returning id into v_id;
  return v_id;
end $$;

-- Ajoute les lignes d'une commande. Les prix proviennent du catalogue ;
-- p_allow_custom autorise (espace commerçant) les lignes libres et les prix négociés.
create function public._apply_order_items(p_order uuid, p_store uuid, p_items jsonb, p_allow_custom boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_item jsonb;
  v_product public.products%rowtype;
  v_product_id uuid;
  v_variant jsonb;
  v_qty integer;
  v_price numeric;
  v_name text;
  v_variant_id text;
  v_variant_name text;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'order_items_required';
  end if;
  if jsonb_array_length(p_items) > 100 then raise exception 'too_many_items'; end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty := coalesce(nullif(v_item ->> 'quantity', '')::integer, 0);
    if v_qty < 1 or v_qty > 999 then raise exception 'invalid_quantity'; end if;
    v_variant_id := nullif(v_item ->> 'variant_id', '');
    v_variant_name := null;
    v_variant := null;
    v_product_id := public.try_uuid(nullif(v_item ->> 'product_id', ''));

    if v_product_id is not null then
      select * into v_product from public.products
      where id = v_product_id and store_id = p_store
      for update;
      if not found then raise exception 'product_unavailable'; end if;
      if v_product.status <> 'active' and not p_allow_custom then raise exception 'product_unavailable'; end if;

      v_name := v_product.name;
      v_price := coalesce(v_product.promo_price, v_product.price);

      if v_variant_id is not null then
        select e into v_variant from jsonb_array_elements(v_product.variants) as e where e ->> 'id' = v_variant_id;
        if v_variant is null or coalesce((v_variant ->> 'available')::boolean, true) = false then
          raise exception 'variant_unavailable';
        end if;
        v_variant_name := left(v_variant ->> 'name', 80);
        if nullif(v_variant ->> 'price', '') is not null then
          v_price := (v_variant ->> 'price')::numeric;
        end if;
      elsif jsonb_array_length(v_product.variants) > 0 and not p_allow_custom then
        raise exception 'variant_required';
      end if;

      if p_allow_custom and nullif(v_item ->> 'unit_price', '') is not null then
        v_price := (v_item ->> 'unit_price')::numeric;
      end if;

      if v_product.track_stock then
        if coalesce(v_product.stock, 0) < v_qty then
          raise exception 'insufficient_stock' using detail = v_product.name;
        end if;
        update public.products set stock = stock - v_qty where id = v_product.id;
      end if;
    else
      if not p_allow_custom then raise exception 'product_unavailable'; end if;
      v_name := left(trim(coalesce(v_item ->> 'name', '')), 120);
      if v_name = '' then raise exception 'item_name_required'; end if;
      v_price := coalesce(nullif(v_item ->> 'unit_price', '')::numeric, -1);
    end if;

    if v_price < 0 then raise exception 'invalid_price'; end if;

    insert into public.order_items (order_id, product_id, name, variant_id, variant_name, unit_price, quantity)
    values (p_order, v_product_id, v_name, v_variant_id, v_variant_name, v_price, v_qty);
  end loop;
end $$;

create function public._restock_order_items(p_order uuid) returns void
language sql security definer set search_path = '' as $$
  update public.products p
  set stock = p.stock + agg.qty
  from (
    select product_id, sum(quantity)::integer as qty
    from public.order_items
    where order_id = p_order and product_id is not null
    group by product_id
  ) agg
  where p.id = agg.product_id and p.track_stock and p.stock is not null
$$;

-- Recalcule l'état de paiement d'une commande (et de sa course) à partir des transactions.
create function public._refresh_payment_status(p_order uuid, p_job uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_paid numeric;
  v_pending boolean;
  v_refunded boolean;
  v_total numeric;
  v_status public.payment_status;
begin
  if p_order is not null then
    select total into v_total from public.orders where id = p_order;
    select coalesce(sum(amount) filter (where status = 'confirmed'), 0),
           bool_or(status = 'pending'),
           bool_or(status = 'refunded')
      into v_paid, v_pending, v_refunded
    from public.transactions where order_id = p_order;
    v_status := case
      when v_refunded and v_paid = 0 then 'refunded'
      when v_total > 0 and v_paid >= v_total then 'paid'
      when coalesce(v_pending, false) then 'pending'
      else 'unpaid'
    end;
    update public.orders set payment_status = v_status where id = p_order and payment_status <> v_status;
    update public.delivery_jobs set payment_status = v_status
    where order_id = p_order and payment_status <> v_status;
  elsif p_job is not null then
    select price into v_total from public.delivery_jobs where id = p_job;
    select coalesce(sum(amount) filter (where status = 'confirmed'), 0),
           bool_or(status = 'pending'),
           bool_or(status = 'refunded')
      into v_paid, v_pending, v_refunded
    from public.transactions where job_id = p_job and order_id is null;
    v_status := case
      when v_refunded and v_paid = 0 then 'refunded'
      when v_total > 0 and v_paid >= v_total then 'paid'
      when coalesce(v_pending, false) then 'pending'
      else 'unpaid'
    end;
    update public.delivery_jobs set payment_status = v_status where id = p_job and payment_status <> v_status;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Commande depuis la boutique publique (client anonyme)
-- Prix, frais de livraison et stock sont recalculés côté serveur.
-- ---------------------------------------------------------------------
create function public.place_storefront_order(p_store_slug text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_store public.stores%rowtype;
  v_name text := left(trim(coalesce(p_payload #>> '{customer,name}', '')), 120);
  v_phone text := public.normalize_phone(p_payload #>> '{customer,phone}');
  v_mode text := coalesce(nullif(p_payload ->> 'delivery_mode', ''), 'delivery');
  v_address text := nullif(left(trim(coalesce(p_payload #>> '{customer,address}', '')), 300), '');
  v_lat double precision := nullif(p_payload #>> '{customer,lat}', '')::double precision;
  v_lng double precision := nullif(p_payload #>> '{customer,lng}', '')::double precision;
  v_method public.payment_method := coalesce(nullif(p_payload ->> 'payment_method', ''), 'cash_on_delivery')::public.payment_method;
  v_customer uuid;
  v_order uuid;
  v_ref text;
  v_total numeric;
begin
  select * into v_store from public.stores
  where slug = lower(coalesce(p_store_slug, '')) and is_published and status = 'active';
  if not found then raise exception 'store_unavailable'; end if;

  if char_length(v_name) < 2 then raise exception 'invalid_name'; end if;
  if not public.is_valid_phone(v_phone) then raise exception 'invalid_phone'; end if;
  if v_mode not in ('delivery', 'pickup') then raise exception 'invalid_delivery_mode'; end if;
  if v_mode = 'delivery' and v_address is null then raise exception 'address_required'; end if;
  if not (v_method = any (v_store.accepted_payment_methods)) then raise exception 'payment_method_not_accepted'; end if;
  if (v_lat is null) <> (v_lng is null)
     or (v_lat is not null and (v_lat not between -90 and 90 or v_lng not between -180 and 180)) then
    raise exception 'invalid_coordinates';
  end if;
  if (select count(*) from public.orders
      where store_id = v_store.id and customer_phone = v_phone and created_at > now() - interval '15 minutes') >= 5 then
    raise exception 'too_many_requests';
  end if;

  v_customer := public._upsert_customer(v_store.id, v_name, v_phone,
    case when v_mode = 'delivery' then v_address end, v_lat, v_lng);

  insert into public.orders (
    store_id, customer_id, customer_name, customer_phone, source, status, delivery_mode,
    delivery_address, delivery_lat, delivery_lng, delivery_fee, currency, payment_method, instructions
  ) values (
    v_store.id, v_customer, v_name, v_phone, 'storefront', 'new', v_mode,
    case when v_mode = 'delivery' then v_address end,
    case when v_mode = 'delivery' then v_lat end,
    case when v_mode = 'delivery' then v_lng end,
    case when v_mode = 'delivery' then v_store.default_delivery_fee else 0 end,
    v_store.currency, v_method,
    nullif(left(trim(coalesce(p_payload ->> 'instructions', '')), 1000), '')
  )
  returning id, reference into v_order, v_ref;

  perform public._apply_order_items(v_order, v_store.id, p_payload -> 'items', false);

  select total into v_total from public.orders where id = v_order;
  return jsonb_build_object('order_id', v_order, 'reference', v_ref, 'total', v_total, 'currency', v_store.currency);
end $$;

-- ---------------------------------------------------------------------
-- Commande saisie par le commerçant (WhatsApp, téléphone, comptoir…)
-- ---------------------------------------------------------------------
create function public.create_order(p_store_id uuid, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_store public.stores%rowtype;
  v_customer public.customers%rowtype;
  v_customer_id uuid := public.try_uuid(nullif(p_payload ->> 'customer_id', ''));
  v_name text := left(trim(coalesce(p_payload #>> '{customer,name}', '')), 120);
  v_phone text := public.normalize_phone(p_payload #>> '{customer,phone}');
  v_mode text := coalesce(nullif(p_payload ->> 'delivery_mode', ''), 'delivery');
  v_address text := nullif(left(trim(coalesce(p_payload ->> 'delivery_address', '')), 300), '');
  v_lat double precision := nullif(p_payload ->> 'delivery_lat', '')::double precision;
  v_lng double precision := nullif(p_payload ->> 'delivery_lng', '')::double precision;
  v_status public.order_status := coalesce(nullif(p_payload ->> 'status', ''), 'new')::public.order_status;
  v_source public.order_source := coalesce(nullif(p_payload ->> 'source', ''), 'manual')::public.order_source;
  v_method public.payment_method := coalesce(nullif(p_payload ->> 'payment_method', ''), 'cash_on_delivery')::public.payment_method;
  v_fee numeric;
  v_discount numeric := greatest(coalesce(nullif(p_payload ->> 'discount', '')::numeric, 0), 0);
  v_order uuid;
  v_ref text;
  v_total numeric;
begin
  if not public.has_store_permission(p_store_id, 'orders.create') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_store from public.stores where id = p_store_id;
  if v_store.status <> 'active' then raise exception 'store_suspended'; end if;
  if v_status not in ('new', 'confirmed') then raise exception 'invalid_status'; end if;
  if v_mode not in ('delivery', 'pickup') then raise exception 'invalid_delivery_mode'; end if;
  if (v_lat is null) <> (v_lng is null) then raise exception 'invalid_coordinates'; end if;

  if v_customer_id is not null then
    select * into v_customer from public.customers where id = v_customer_id and store_id = p_store_id;
    if not found then raise exception 'customer_not_found'; end if;
    if v_name = '' then v_name := v_customer.full_name; end if;
    if v_phone is null then v_phone := v_customer.phone; end if;
    if v_mode = 'delivery' and v_address is null then
      v_address := v_customer.address;
      v_lat := coalesce(v_lat, v_customer.lat);
      v_lng := coalesce(v_lng, v_customer.lng);
    end if;
  end if;

  if char_length(v_name) < 2 then raise exception 'invalid_name'; end if;
  if not public.is_valid_phone(v_phone) then raise exception 'invalid_phone'; end if;

  if v_customer_id is null and coalesce((p_payload ->> 'save_customer')::boolean, true) then
    v_customer_id := public._upsert_customer(p_store_id, v_name, v_phone,
      case when v_mode = 'delivery' then v_address end, v_lat, v_lng);
  end if;

  v_fee := case
    when v_mode = 'pickup' then 0
    else greatest(coalesce(nullif(p_payload ->> 'delivery_fee', '')::numeric, v_store.default_delivery_fee), 0)
  end;

  insert into public.orders (
    store_id, customer_id, customer_name, customer_phone, source, status, delivery_mode,
    delivery_address, delivery_lat, delivery_lng, delivery_fee, discount, currency,
    payment_method, instructions, internal_note, created_by
  ) values (
    p_store_id, v_customer_id, v_name, v_phone, v_source, v_status, v_mode,
    case when v_mode = 'delivery' then v_address end,
    case when v_mode = 'delivery' then v_lat end,
    case when v_mode = 'delivery' then v_lng end,
    v_fee, v_discount, v_store.currency, v_method,
    nullif(left(trim(coalesce(p_payload ->> 'instructions', '')), 1000), ''),
    nullif(left(trim(coalesce(p_payload ->> 'internal_note', '')), 1000), ''),
    (select auth.uid())
  )
  returning id, reference into v_order, v_ref;

  perform public._apply_order_items(v_order, p_store_id, p_payload -> 'items', true);

  select total into v_total from public.orders where id = v_order;

  if coalesce((p_payload ->> 'mark_paid')::boolean, false) and v_total > 0 then
    insert into public.transactions (store_id, order_id, amount, currency, method, provider, status, notes, recorded_by, confirmed_by, confirmed_at)
    values (p_store_id, v_order, v_total, v_store.currency, v_method, 'manual', 'confirmed',
            'Paiement enregistré à la création de la commande', (select auth.uid()), (select auth.uid()), now());
    perform public._refresh_payment_status(v_order, null);
  end if;

  perform public.log_activity('order.created', p_store_id, 'order', v_order::text, jsonb_build_object('reference', v_ref));
  return jsonb_build_object('id', v_order, 'reference', v_ref, 'total', v_total);
end $$;

-- Remplace les lignes d'une commande encore modifiable.
create function public.set_order_items(p_order_id uuid, p_items jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'not_found'; end if;
  if not public.has_store_permission(v_order.store_id, 'orders.edit') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_order.status not in ('new', 'confirmed', 'preparing') then raise exception 'order_locked'; end if;

  perform public._restock_order_items(p_order_id);
  delete from public.order_items where order_id = p_order_id;
  perform public._apply_order_items(p_order_id, v_order.store_id, p_items, true);

  insert into public.order_events (order_id, store_id, type, message, actor_id)
  values (p_order_id, v_order.store_id, 'items_updated', null, (select auth.uid()));
end $$;

-- Changement de statut manuel par la boutique.
create function public.set_order_status(p_order_id uuid, p_status public.order_status, p_note text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_job public.delivery_jobs%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'not_found'; end if;
  if not public.has_store_permission(v_order.store_id, 'orders.edit') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_order.status = p_status then return; end if;
  if not public.order_transition_allowed(v_order.status, p_status) then
    raise exception 'invalid_transition';
  end if;

  if v_order.current_job_id is not null then
    select * into v_job from public.delivery_jobs where id = v_order.current_job_id for update;
    if found and v_job.status in ('pending', 'offered', 'accepted', 'picked_up', 'in_transit') then
      if p_status in ('handed_to_courier', 'in_transit', 'delivered', 'delivery_failed') then
        raise exception 'job_in_progress';
      end if;
      if p_status = 'cancelled' then
        update public.delivery_assignments set status = 'revoked', responded_at = now()
        where job_id = v_job.id and status in ('offered', 'accepted');
        update public.delivery_jobs
        set status = 'cancelled', cancel_reason = coalesce(nullif(trim(p_note), ''), 'Commande annulée')
        where id = v_job.id;
      end if;
    end if;
  end if;

  if p_status = 'cancelled' then
    perform public._restock_order_items(p_order_id);
  end if;

  update public.orders set status = p_status where id = p_order_id;

  if nullif(trim(coalesce(p_note, '')), '') is not null then
    insert into public.order_events (order_id, store_id, type, message, actor_id)
    values (p_order_id, v_order.store_id, 'note', left(trim(p_note), 1000), (select auth.uid()));
  end if;
end $$;

create function public.add_order_note(p_order_id uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_store uuid;
begin
  select store_id into v_store from public.orders where id = p_order_id;
  if v_store is null then raise exception 'not_found'; end if;
  if not public.is_store_member(v_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_note, ''))) = 0 then raise exception 'note_required'; end if;
  insert into public.order_events (order_id, store_id, type, message, actor_id)
  values (p_order_id, v_store, 'note', left(trim(p_note), 1000), (select auth.uid()));
end $$;

-- ---------------------------------------------------------------------
-- Équipe : invitations et permissions
-- ---------------------------------------------------------------------
create function public._hash_token(p_token text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex')
$$;

create function public.create_staff_invitation(p_store_id uuid, p_permissions text[], p_label text default null)
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

create function public.revoke_invitation(p_invitation_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_store uuid;
begin
  select store_id into v_store from public.invitations where id = p_invitation_id;
  if v_store is null or not public.is_store_owner(v_store) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.invitations set revoked_at = now() where id = p_invitation_id and accepted_at is null;
end $$;

create function public.get_invitation(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_inv public.invitations%rowtype;
  v_store public.stores%rowtype;
  v_courier_name text;
  v_reason text;
begin
  if p_token is null or char_length(p_token) <> 32 then return null; end if;
  select * into v_inv from public.invitations where token_hash = public._hash_token(p_token);
  if not found then return null; end if;
  select * into v_store from public.stores where id = v_inv.store_id;
  if v_inv.courier_id is not null then
    select full_name into v_courier_name from public.couriers where id = v_inv.courier_id;
  end if;
  v_reason := case
    when v_inv.revoked_at is not null then 'revoked'
    when v_inv.accepted_at is not null then 'used'
    when v_inv.expires_at < now() then 'expired'
    when v_store.status <> 'active' then 'store_suspended'
    else null
  end;
  return jsonb_build_object(
    'kind', v_inv.kind,
    'store_name', v_store.name,
    'store_logo_path', v_store.logo_path,
    'label', v_inv.label,
    'courier_name', v_courier_name,
    'permissions', to_jsonb(v_inv.permissions),
    'expires_at', v_inv.expires_at,
    'valid', v_reason is null,
    'reason', v_reason
  );
end $$;

create function public.accept_invitation(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_inv public.invitations%rowtype;
  v_existing public.couriers%rowtype;
  v_placeholder public.couriers%rowtype;
  v_courier_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_active_user() then raise exception 'account_suspended'; end if;
  select * into v_inv from public.invitations where token_hash = public._hash_token(coalesce(p_token, '')) for update;
  if not found then raise exception 'invitation_invalid'; end if;
  if v_inv.revoked_at is not null or v_inv.accepted_at is not null or v_inv.expires_at < now() then
    raise exception 'invitation_invalid';
  end if;

  if v_inv.kind = 'staff' then
    if exists (select 1 from public.store_members where store_id = v_inv.store_id and user_id = v_uid) then
      raise exception 'already_member';
    end if;
    insert into public.store_members (store_id, user_id, role, permissions)
    values (v_inv.store_id, v_uid, 'staff', v_inv.permissions);
  else
    select * into v_placeholder from public.couriers where id = v_inv.courier_id for update;
    if not found then raise exception 'invitation_invalid'; end if;
    select * into v_existing from public.couriers where user_id = v_uid for update;
    if found then
      -- L'utilisateur est déjà livreur : on rattache la boutique à son profil existant.
      insert into public.courier_store_memberships (courier_id, store_id)
      values (v_existing.id, v_inv.store_id)
      on conflict (courier_id, store_id) do update set status = 'active';
      if v_placeholder.user_id is null and v_placeholder.id <> v_existing.id
         and not exists (select 1 from public.delivery_jobs where courier_id = v_placeholder.id) then
        delete from public.couriers where id = v_placeholder.id;
      end if;
      v_courier_id := v_existing.id;
    else
      if v_placeholder.user_id is not null then raise exception 'invitation_invalid'; end if;
      update public.couriers set user_id = v_uid, account_status = 'active' where id = v_placeholder.id;
      v_courier_id := v_placeholder.id;
    end if;
  end if;

  update public.invitations set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  perform public.log_activity('invitation.accepted', v_inv.store_id, 'invitation', v_inv.id::text,
    jsonb_build_object('kind', v_inv.kind));
  return jsonb_build_object('kind', v_inv.kind, 'store_id', v_inv.store_id, 'courier_id', v_courier_id);
end $$;

create function public.update_member_permissions(p_store_id uuid, p_user_id uuid, p_permissions text[])
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_store_owner(p_store_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if not (coalesce(p_permissions, '{}') <@ array['orders.create', 'orders.edit', 'products.view', 'products.manage',
                           'customers.view', 'couriers.assign', 'stats.view']::text[]) then
    raise exception 'invalid_permissions';
  end if;
  update public.store_members set permissions = coalesce(p_permissions, '{}')
  where store_id = p_store_id and user_id = p_user_id and role = 'staff';
  if not found then raise exception 'not_found'; end if;
  perform public.log_activity('staff.permissions_updated', p_store_id, 'profile', p_user_id::text,
    jsonb_build_object('permissions', p_permissions));
end $$;

create function public.remove_store_member(p_store_id uuid, p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_store_owner(p_store_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.store_members where store_id = p_store_id and user_id = p_user_id and role = 'staff';
  if not found then raise exception 'not_found'; end if;
  perform public.log_activity('staff.removed', p_store_id, 'profile', p_user_id::text);
end $$;
