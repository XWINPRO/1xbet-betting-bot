-- =====================================================================
-- Relais · 002 — Fonctions d'accès, déclencheurs métier, politiques RLS
-- Principe : les tables sont lisibles via RLS ; les écritures sensibles
-- passent par des fonctions RPC (migration 003) qui valident les règles.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Paramètres
-- ---------------------------------------------------------------------
create function public.setting_int(p_key text, p_default integer) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select (value #>> '{}')::integer from public.platform_settings where key = p_key),
    p_default
  )
$$;

create function public.setting_bool(p_key text, p_default boolean) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select (value #>> '{}')::boolean from public.platform_settings where key = p_key),
    p_default
  )
$$;

-- ---------------------------------------------------------------------
-- Fonctions d'accès (utilisées par les politiques RLS)
-- ---------------------------------------------------------------------
create function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_platform_admin and not is_suspended
  )
$$;

create function public.is_active_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and not is_suspended
  )
$$;

create function public.is_store_member(p_store uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.store_members m
    join public.profiles p on p.id = m.user_id
    where m.store_id = p_store and m.user_id = (select auth.uid()) and not p.is_suspended
  )
$$;

create function public.is_store_owner(p_store uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.store_members m
    join public.profiles p on p.id = m.user_id
    where m.store_id = p_store and m.user_id = (select auth.uid())
      and m.role = 'owner' and not p.is_suspended
  )
$$;

create function public.has_store_permission(p_store uuid, p_perm text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.store_members m
    join public.profiles p on p.id = m.user_id
    where m.store_id = p_store and m.user_id = (select auth.uid()) and not p.is_suspended
      and (m.role = 'owner' or p_perm = any (m.permissions))
  )
$$;

create function public.my_courier_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select c.id
  from public.couriers c
  join public.profiles p on p.id = c.user_id
  where c.user_id = (select auth.uid()) and not p.is_suspended
$$;

-- L'utilisateur courant est-il membre d'une boutique à laquelle ce livreur est rattaché ?
create function public.is_store_courier_of(p_courier uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.courier_store_memberships csm
    join public.store_members m on m.store_id = csm.store_id
    where csm.courier_id = p_courier and m.user_id = (select auth.uid())
  )
$$;

create function public.shares_store_with(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.store_members a
    join public.store_members b on b.store_id = a.store_id
    where a.user_id = (select auth.uid()) and b.user_id = p_user
  )
$$;

-- ---------------------------------------------------------------------
-- Disponibilité réelle d'un livreur
-- « Connecté » ne veut pas dire « disponible » :
--   inactive    : compte non actif
--   busy        : nombre de courses actives >= limite configurée
--   unavailable : le livreur s'est déclaré indisponible
--   offline     : aucun signal reçu depuis courier.offline_after_s
--   available   : disponible, signal récent, capacité restante
-- ---------------------------------------------------------------------
create function public.courier_active_jobs(p_courier uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer
  from public.delivery_jobs
  where courier_id = p_courier and status in ('accepted', 'picked_up', 'in_transit')
$$;

create function public.courier_effective_status(
  p_account public.courier_account_status,
  p_availability public.courier_availability,
  p_last_seen timestamptz,
  p_active_jobs integer,
  p_max_jobs integer
) returns text
language sql stable set search_path = '' as $$
  select case
    when p_account <> 'active' then 'inactive'
    when p_active_jobs >= greatest(coalesce(p_max_jobs, 1), 1) then 'busy'
    when p_availability = 'unavailable' then 'unavailable'
    when p_last_seen is null
      or p_last_seen < now() - make_interval(secs => public.setting_int('courier.offline_after_s', 180))
      then 'offline'
    else 'available'
  end
$$;

-- ---------------------------------------------------------------------
-- Journal d'activité (usage interne par les RPC)
-- ---------------------------------------------------------------------
create function public.log_activity(
  p_action text, p_store uuid, p_entity_type text, p_entity_id text, p_metadata jsonb default '{}'::jsonb
) returns void
language sql security definer set search_path = '' as $$
  insert into public.activity_logs (actor_id, store_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), p_store, p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb))
$$;

-- Notification temps réel « quelque chose a changé » pour la page de suivi publique.
-- Le message ne contient aucune donnée : la page relit l'état via get_tracking().
-- Un message forgé ne peut donc pas afficher de fausse position.
create function public.broadcast_tracking(p_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(jsonb_build_object('at', now()), 'changed', 'track:' || p_token, false);
exception when others then
  null;
end $$;

-- ---------------------------------------------------------------------
-- Déclencheurs : commandes
-- ---------------------------------------------------------------------
create function public.orders_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.stores set order_seq = order_seq + 1
  where id = new.store_id
  returning order_seq into new.number;
  new.reference := 'CMD-' || new.number::text;
  new.total := greatest(new.subtotal + new.delivery_fee - new.discount, 0);
  return new;
end $$;
create trigger orders_before_insert before insert on public.orders
  for each row execute function public.orders_before_insert();

create function public.orders_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.total := greatest(new.subtotal + new.delivery_fee - new.discount, 0);
  if new.status is distinct from old.status then
    if new.status = 'confirmed' and new.confirmed_at is null then new.confirmed_at := now(); end if;
    if new.status = 'delivered' then new.delivered_at := now(); end if;
    if new.status = 'cancelled' then new.cancelled_at := now(); end if;
  end if;
  return new;
end $$;
create trigger orders_before_update before update on public.orders
  for each row execute function public.orders_before_update();

create function public.orders_after_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_events (order_id, store_id, type, to_status, actor_id)
    values (new.id, new.store_id, 'created', new.status, (select auth.uid()));
  else
    if new.status is distinct from old.status then
      insert into public.order_events (order_id, store_id, type, from_status, to_status, actor_id)
      values (new.id, new.store_id, 'status_changed', old.status, new.status, (select auth.uid()));
    end if;
    if new.payment_status is distinct from old.payment_status then
      insert into public.order_events (order_id, store_id, type, message, actor_id)
      values (new.id, new.store_id, 'payment_changed', new.payment_status::text, (select auth.uid()));
    end if;
  end if;
  return null;
end $$;
create trigger orders_after_change after insert or update on public.orders
  for each row execute function public.orders_after_change();

create function public.order_items_recalc() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_order uuid := coalesce(new.order_id, old.order_id);
begin
  update public.orders
  set subtotal = coalesce((select sum(line_total) from public.order_items where order_id = v_order), 0)
  where id = v_order;
  return null;
end $$;
create trigger order_items_recalc after insert or update or delete on public.order_items
  for each row execute function public.order_items_recalc();

-- La catégorie d'un produit doit appartenir à la même boutique.
create function public.products_check_category() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.product_categories where id = new.category_id and store_id = new.store_id
  ) then
    raise exception 'invalid_category' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger products_check_category before insert or update of category_id, store_id on public.products
  for each row execute function public.products_check_category();

-- ---------------------------------------------------------------------
-- Déclencheurs : courses
-- ---------------------------------------------------------------------
create function public.delivery_jobs_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    case new.status
      when 'offered' then new.offered_at := now();
      when 'accepted' then new.accepted_at := now();
      when 'picked_up' then new.picked_up_at := now();
      when 'in_transit' then new.in_transit_at := now();
      when 'delivered' then new.delivered_at := now();
      when 'failed' then new.failed_at := now();
      when 'cancelled' then new.cancelled_at := now();
      else null;
    end case;
    if new.status in ('delivered', 'failed', 'cancelled') then
      new.tracking_active := false;
    end if;
  end if;
  return new;
end $$;
create trigger delivery_jobs_before_update before update on public.delivery_jobs
  for each row execute function public.delivery_jobs_before_update();

create function public.delivery_jobs_after_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_target public.order_status;
begin
  if tg_op = 'INSERT' then
    insert into public.delivery_events (job_id, type, status, actor_id)
    values (new.id, 'created', new.status, (select auth.uid()));
    return null;
  end if;

  if new.status is distinct from old.status then
    insert into public.delivery_events (job_id, type, status, actor_id)
    values (new.id, 'status_changed', new.status, (select auth.uid()));

    -- Synchronisation du statut de la commande liée
    if new.order_id is not null then
      v_target := case new.status
        when 'picked_up' then 'handed_to_courier'::public.order_status
        when 'in_transit' then 'in_transit'::public.order_status
        when 'delivered' then 'delivered'::public.order_status
        when 'failed' then 'delivery_failed'::public.order_status
        else null
      end;
      if v_target is not null then
        update public.orders set status = v_target
        where id = new.order_id and status not in ('cancelled', 'delivered') and status <> v_target;
      end if;
    end if;
  end if;

  if new.status is distinct from old.status
     or new.courier_id is distinct from old.courier_id
     or new.recipient_confirmed_at is distinct from old.recipient_confirmed_at then
    perform public.broadcast_tracking(new.tracking_token);
  end if;
  return null;
end $$;
create trigger delivery_jobs_after_change after insert or update on public.delivery_jobs
  for each row execute function public.delivery_jobs_after_change();

-- ---------------------------------------------------------------------
-- Déclencheur : réclamations
-- ---------------------------------------------------------------------
create function public.claims_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status and new.status in ('resolved', 'rejected') then
    new.resolved_at := now();
    new.resolved_by := (select auth.uid());
  end if;
  return new;
end $$;
create trigger claims_before_update before update on public.claims
  for each row execute function public.claims_before_update();

-- =====================================================================
-- Politiques RLS
-- =====================================================================

-- profiles -------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_platform_admin()) or public.shares_store_with(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- organizations --------------------------------------------------------
create policy organizations_select on public.organizations for select to authenticated
  using (
    owner_id = (select auth.uid())
    or (select public.is_platform_admin())
    or exists (select 1 from public.stores s where s.organization_id = organizations.id and public.is_store_member(s.id))
  );
create policy organizations_update on public.organizations for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- stores ---------------------------------------------------------------
create policy stores_select on public.stores for select to anon, authenticated
  using (
    (is_published and status = 'active')
    or public.is_store_member(id)
    or (select public.is_platform_admin())
    or exists (
      select 1 from public.courier_store_memberships csm
      where csm.store_id = stores.id and csm.courier_id = (select public.my_courier_id())
    )
  );
create policy stores_update_owner on public.stores for update to authenticated
  using (public.is_store_owner(id)) with check (public.is_store_owner(id));

-- store_members --------------------------------------------------------
create policy store_members_select on public.store_members for select to authenticated
  using (public.is_store_member(store_id) or (select public.is_platform_admin()));

-- product_categories ---------------------------------------------------
create policy product_categories_select on public.product_categories for select to anon, authenticated
  using (
    exists (select 1 from public.stores s where s.id = store_id and s.is_published and s.status = 'active')
    or public.is_store_member(store_id)
    or (select public.is_platform_admin())
  );
create policy product_categories_insert on public.product_categories for insert to authenticated
  with check (public.has_store_permission(store_id, 'products.manage'));
create policy product_categories_update on public.product_categories for update to authenticated
  using (public.has_store_permission(store_id, 'products.manage'))
  with check (public.has_store_permission(store_id, 'products.manage'));
create policy product_categories_delete on public.product_categories for delete to authenticated
  using (public.has_store_permission(store_id, 'products.manage'));

-- products -------------------------------------------------------------
create policy products_select on public.products for select to anon, authenticated
  using (
    (status = 'active' and exists (
      select 1 from public.stores s where s.id = store_id and s.is_published and s.status = 'active'
    ))
    or public.is_store_member(store_id)
    or (select public.is_platform_admin())
  );
create policy products_insert on public.products for insert to authenticated
  with check (public.has_store_permission(store_id, 'products.manage'));
create policy products_update on public.products for update to authenticated
  using (public.has_store_permission(store_id, 'products.manage'))
  with check (public.has_store_permission(store_id, 'products.manage'));
create policy products_delete on public.products for delete to authenticated
  using (public.has_store_permission(store_id, 'products.manage'));

-- customers ------------------------------------------------------------
create policy customers_select on public.customers for select to authenticated
  using (
    public.has_store_permission(store_id, 'customers.view')
    or public.has_store_permission(store_id, 'orders.create')
    or public.has_store_permission(store_id, 'orders.edit')
    or (select public.is_platform_admin())
  );
create policy customers_insert on public.customers for insert to authenticated
  with check (
    public.has_store_permission(store_id, 'orders.create') or public.has_store_permission(store_id, 'orders.edit')
  );
create policy customers_update on public.customers for update to authenticated
  using (public.has_store_permission(store_id, 'orders.create') or public.has_store_permission(store_id, 'orders.edit'))
  with check (public.has_store_permission(store_id, 'orders.create') or public.has_store_permission(store_id, 'orders.edit'));
create policy customers_delete on public.customers for delete to authenticated
  using (public.is_store_owner(store_id));

-- orders ---------------------------------------------------------------
create policy orders_select on public.orders for select to authenticated
  using (
    public.is_store_member(store_id)
    or (select public.is_platform_admin())
    or exists (
      select 1 from public.delivery_jobs j
      where j.order_id = orders.id and j.courier_id = (select public.my_courier_id())
        and j.status in ('offered', 'accepted', 'picked_up', 'in_transit', 'delivered', 'failed')
    )
  );
create policy orders_update on public.orders for update to authenticated
  using (public.has_store_permission(store_id, 'orders.edit'))
  with check (public.has_store_permission(store_id, 'orders.edit'));

-- order_items : visibles si la commande l'est (RLS de orders appliquée)
create policy order_items_select on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

create policy order_events_select on public.order_events for select to authenticated
  using (public.is_store_member(store_id) or (select public.is_platform_admin()));

-- couriers -------------------------------------------------------------
create policy couriers_select on public.couriers for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_platform_admin())
    or public.is_store_courier_of(id)
  );

create policy courier_store_memberships_select on public.courier_store_memberships for select to authenticated
  using (
    public.is_store_member(store_id)
    or courier_id = (select public.my_courier_id())
    or (select public.is_platform_admin())
  );

-- delivery_jobs --------------------------------------------------------
create policy delivery_jobs_select on public.delivery_jobs for select to authenticated
  using (
    (select public.is_platform_admin())
    or (store_id is not null and public.is_store_member(store_id))
    or (courier_id is not null and courier_id = (select public.my_courier_id()))
    or (requester_user_id is not null and requester_user_id = (select auth.uid()))
  );

create policy delivery_assignments_select on public.delivery_assignments for select to authenticated
  using (
    courier_id = (select public.my_courier_id())
    or exists (
      select 1 from public.delivery_jobs j
      where j.id = job_id
        and ((select public.is_platform_admin()) or (j.store_id is not null and public.is_store_member(j.store_id)))
    )
  );

create policy delivery_events_select on public.delivery_events for select to authenticated
  using (exists (select 1 from public.delivery_jobs j where j.id = job_id));

create policy courier_locations_select on public.courier_locations for select to authenticated
  using (
    courier_id = (select public.my_courier_id())
    or (select public.is_platform_admin())
    or (job_id is not null and exists (
      select 1 from public.delivery_jobs j
      where j.id = job_id and j.store_id is not null and public.is_store_member(j.store_id)
    ))
  );

-- pricing_rules --------------------------------------------------------
create policy pricing_rules_select on public.pricing_rules for select to anon, authenticated
  using (is_active or (select public.is_platform_admin()));
create policy pricing_rules_insert on public.pricing_rules for insert to authenticated
  with check ((select public.is_platform_admin()));
create policy pricing_rules_update on public.pricing_rules for update to authenticated
  using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));
create policy pricing_rules_delete on public.pricing_rules for delete to authenticated
  using ((select public.is_platform_admin()));

-- transactions ---------------------------------------------------------
create policy transactions_select on public.transactions for select to authenticated
  using (
    (select public.is_platform_admin())
    or (store_id is not null and (
      public.has_store_permission(store_id, 'orders.edit') or public.has_store_permission(store_id, 'stats.view')
    ))
  );

-- claims ---------------------------------------------------------------
create policy claims_select on public.claims for select to authenticated
  using (
    (select public.is_platform_admin())
    or (store_id is not null and public.is_store_member(store_id))
    or reporter_user_id = (select auth.uid())
  );
create policy claims_update on public.claims for update to authenticated
  using ((select public.is_platform_admin()) or (store_id is not null and public.is_store_owner(store_id)))
  with check ((select public.is_platform_admin()) or (store_id is not null and public.is_store_owner(store_id)));

-- platform_settings ----------------------------------------------------
create policy platform_settings_select on public.platform_settings for select to authenticated
  using (true);
create policy platform_settings_update on public.platform_settings for update to authenticated
  using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));

-- invitations ----------------------------------------------------------
create policy invitations_select on public.invitations for select to authenticated
  using (public.is_store_owner(store_id) or (select public.is_platform_admin()));

-- activity_logs --------------------------------------------------------
create policy activity_logs_select on public.activity_logs for select to authenticated
  using ((select public.is_platform_admin()) or (store_id is not null and public.is_store_owner(store_id)));

-- =====================================================================
-- Privilèges de table (le moindre privilège ; les RPC font le reste)
-- =====================================================================
revoke all on all tables in schema public from anon, authenticated;

grant select on public.stores, public.products, public.product_categories, public.pricing_rules to anon;
grant select on all tables in schema public to authenticated;

grant update (full_name, phone, avatar_url) on public.profiles to authenticated;
grant update (name) on public.organizations to authenticated;
grant update (
  name, slug, description, category, phone, whatsapp, email, address, city, lat, lng,
  logo_path, banner_path, opening_hours, delivery_terms, default_delivery_fee,
  accepted_payment_methods, is_published, courier_max_active_jobs, share_courier_phone
) on public.stores to authenticated;
grant insert, update, delete on public.product_categories, public.products, public.customers to authenticated;
grant update (
  customer_name, customer_phone, delivery_mode, delivery_address, delivery_lat, delivery_lng,
  delivery_fee, discount, payment_method, instructions, internal_note
) on public.orders to authenticated;
grant insert, update, delete on public.pricing_rules to authenticated;
grant update (value) on public.platform_settings to authenticated;
grant update (status, resolution) on public.claims to authenticated;
