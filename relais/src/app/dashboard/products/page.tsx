import Link from "next/link";
import { ImageOff, Package, Plus } from "lucide-react";
import { getSiteUrl, getStoreContext } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { PRODUCT_STATUS } from "@/lib/status";
import { publicAssetUrl } from "@/lib/storage";
import { pageNumber, sanitizeSearch } from "@/lib/search";
import { waMessages } from "@/lib/whatsapp";
import { param } from "@/lib/utils";
import { EmptyState, PageContainer, PageHeader } from "@/components/ui/page";
import { Panel } from "@/components/ui/panel";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { ParamSelect, SearchInput } from "@/components/ui/client-helpers";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { ProductRowActions, ProductStatusToggle } from "@/components/products/product-row-actions";
import { CategoryManager } from "@/components/products/category-manager";
import type { ProductStatus } from "@/types/domain";

export const metadata = { title: "Produits" };
const PAGE_SIZE = 30;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ctx = await getStoreContext();
  if (!(ctx.can("products.view") || ctx.can("products.manage") || ctx.can("orders.create"))) redirect("/dashboard?denied=1");
  const canManage = ctx.can("products.manage");
  const supabase = await createSupabaseServerClient();
  const tab = param(sp.tab) ?? "all";
  const q = sanitizeSearch(param(sp.q));
  const category = param(sp.category);
  const page = pageNumber(param(sp.page));

  let query = supabase
    .from("products")
    .select("id, name, price, promo_price, status, track_stock, stock, images, sku, category_id, product_categories(name), variants", { count: "exact" })
    .eq("store_id", ctx.storeId)
    .order("updated_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (tab === "active" || tab === "inactive" || tab === "archived") query = query.eq("status", tab as ProductStatus);
  else query = query.neq("status", "archived");
  if (tab === "out") query = query.eq("track_stock", true).lte("stock", 0);
  if (q) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`);
  if (category === "none") query = query.is("category_id", null);
  else if (category) query = query.eq("category_id", category);

  const [{ data: products, count, error }, { data: categories }, { data: allForCounts }] = await Promise.all([
    query,
    supabase.from("product_categories").select("id, name").eq("store_id", ctx.storeId).order("position"),
    supabase.from("products").select("category_id").eq("store_id", ctx.storeId),
  ]);
  if (error) throw error;
  const site = await getSiteUrl();
  const shopBase = ctx.store.is_published ? `${site}/shop/${ctx.store.slug}` : null;
  const hasAny = (allForCounts?.length ?? 0) > 0;

  const href = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams();
    const base: Record<string, string | undefined> = { tab: tab === "all" ? undefined : tab, q: q ?? undefined, category };
    for (const [k, val] of Object.entries({ ...base, ...patch })) if (val) params.set(k, val);
    const s = params.toString();
    return `/dashboard/products${s ? `?${s}` : ""}`;
  };

  return (
    <PageContainer>
      <PageHeader
        title="Produits"
        description="Votre catalogue, affiché sur la boutique en ligne et utilisé pour la saisie des commandes."
        actions={
          canManage ? (
            <>
              <CategoryManager categories={(categories ?? []).map((c) => ({ ...c, count: allForCounts?.filter((p) => p.category_id === c.id).length ?? 0 }))} />
              <Button asChild variant="primary">
                <Link href="/dashboard/products/new">
                  <Plus /> Ajouter un produit
                </Link>
              </Button>
            </>
          ) : null
        }
      />
      <Panel>
        <div className="flex flex-col gap-3 border-b border-line px-5 pt-2 lg:flex-row lg:items-end lg:justify-between">
          <FilterTabs
            active={tab}
            items={[
              { key: "all", label: "Tous", href: href({ tab: null, page: null }) },
              { key: "active", label: "En vente", href: href({ tab: "active", page: null }) },
              { key: "inactive", label: "Masqués", href: href({ tab: "inactive", page: null }) },
              { key: "out", label: "En rupture", href: href({ tab: "out", page: null }) },
              { key: "archived", label: "Archivés", href: href({ tab: "archived", page: null }) },
            ]}
          />
          <div className="flex gap-2 pb-2.5">
            <ParamSelect
              param="category"
              label="Catégorie"
              options={[{ value: "", label: "Toutes catégories" }, { value: "none", label: "Sans catégorie" }, ...(categories ?? []).map((c) => ({ value: c.id, label: c.name }))]}
            />
            <SearchInput placeholder="Nom ou SKU" />
          </div>
        </div>
        {!products?.length ? (
          <EmptyState
            icon={<Package />}
            title={hasAny ? "Aucun produit ne correspond" : "Votre catalogue est vide"}
            description={hasAny ? "Modifiez la recherche ou les filtres." : "Ajoutez vos produits avec photos, prix et stock : ils apparaîtront sur votre boutique en ligne."}
            action={
              !hasAny && canManage ? (
                <Button asChild variant="primary">
                  <Link href="/dashboard/products/new">Ajouter un produit</Link>
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <TableWrap>
              <Table>
                <THead>
                  <tr>
                    <TH>Produit</TH>
                    <TH className="hidden md:table-cell">Catégorie</TH>
                    <TH align="right">Prix</TH>
                    <TH align="right" className="hidden sm:table-cell">Stock</TH>
                    <TH>Statut</TH>
                    <TH className="w-10" />
                  </tr>
                </THead>
                <tbody>
                  {products.map((p) => {
                    const img = publicAssetUrl(p.images?.[0]);
                    const shareUrl = shopBase && p.status === "active" ? `${shopBase}?p=${p.id}` : null;
                    const variantsCount = Array.isArray(p.variants) ? p.variants.length : 0;
                    return (
                      <TR key={p.id}>
                        <TD>
                          <div className="flex items-center gap-3">
                            <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-subtle">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              {img ? <img src={img} alt="" className="size-full object-cover" loading="lazy" /> : <ImageOff className="size-4 text-ink-4" />}
                            </div>
                            <div className="min-w-0">
                              {canManage ? (
                                <Link href={`/dashboard/products/${p.id}`} className="block truncate font-medium text-ink hover:text-accent">
                                  {p.name}
                                </Link>
                              ) : (
                                <span className="block truncate font-medium">{p.name}</span>
                              )}
                              <span className="text-xs text-ink-3">
                                {p.sku ? `SKU ${p.sku}` : ""}
                                {p.sku && variantsCount ? " · " : ""}
                                {variantsCount ? `${variantsCount} variante(s)` : ""}
                              </span>
                            </div>
                          </div>
                        </TD>
                        <TD className="hidden text-ink-2 md:table-cell">{p.product_categories?.name ?? <span className="text-ink-4">—</span>}</TD>
                        <TD align="right">
                          {p.promo_price !== null ? (
                            <>
                              <span className="font-medium">{formatMoney(p.promo_price, ctx.store.currency)}</span>
                              <span className="block text-xs text-ink-4 line-through">{formatMoney(p.price, ctx.store.currency)}</span>
                            </>
                          ) : (
                            <span className="font-medium">{formatMoney(p.price, ctx.store.currency)}</span>
                          )}
                        </TD>
                        <TD align="right" className="hidden sm:table-cell">
                          {p.track_stock ? <span className={(p.stock ?? 0) <= 0 ? "font-medium text-danger-ink" : (p.stock ?? 0) <= 3 ? "text-warning-ink" : ""}>{p.stock ?? 0}</span> : <span className="text-ink-4">Non suivi</span>}
                        </TD>
                        <TD>
                          <div className="flex items-center gap-2.5">
                            {canManage && p.status !== "archived" ? <ProductStatusToggle id={p.id} status={p.status} /> : null}
                            <StatusBadge map={PRODUCT_STATUS} value={p.status} />
                          </div>
                        </TD>
                        <TD>
                          <ProductRowActions
                            id={p.id}
                            status={p.status}
                            canManage={canManage}
                            shareUrl={shareUrl}
                            shareText={shareUrl ? waMessages.productShare({ storeName: ctx.store.name, productName: p.name, price: p.promo_price ?? p.price, currency: ctx.store.currency, url: shareUrl }) : ""}
                          />
                        </TD>
                      </TR>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
            <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} makeHref={(n) => href({ page: String(n) })} />
          </>
        )}
      </Panel>
    </PageContainer>
  );
}
