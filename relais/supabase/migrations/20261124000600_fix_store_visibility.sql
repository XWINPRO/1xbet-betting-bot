-- =====================================================================
-- Relais · 006 — Correctif : la politique de lecture des boutiques
-- interrogeait courier_store_memberships, table non lisible par le rôle
-- anon ; les visiteurs ne pouvaient donc pas ouvrir une boutique publique.
-- La vérification passe désormais par une fonction SECURITY DEFINER.
-- =====================================================================

create function public.is_store_courier(p_store uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.courier_store_memberships csm
    where csm.store_id = p_store and csm.courier_id = public.my_courier_id()
  )
$$;
revoke execute on function public.is_store_courier(uuid) from public;
grant execute on function public.is_store_courier(uuid) to anon, authenticated;

drop policy stores_select on public.stores;
create policy stores_select on public.stores for select to anon, authenticated
  using (
    (is_published and status = 'active')
    or public.is_store_member(id)
    or (select public.is_platform_admin())
    or public.is_store_courier(id)
  );
