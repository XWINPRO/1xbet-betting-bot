import { notFound } from "next/navigation";
import { requireStorePermission } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { ProductForm } from "@/components/products/product-form";
import type { ProductVariant } from "@/types/domain";

export const metadata = { title: "Modifier le produit" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireStorePermission("products.manage");
  const supabase = await createSupabaseServerClient();
  const [{ data: product }, { data: categories }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).eq("store_id", ctx.storeId).maybeSingle(),
    supabase.from("product_categories").select("id, name").eq("store_id", ctx.storeId).order("position"),
  ]);
  if (!product) notFound();
  return (
    <PageContainer>
      <PageHeader title={product.name} back={{ href: "/dashboard/products", label: "Produits" }} />
      <ProductForm
        storeId={ctx.storeId}
        productId={product.id}
        categories={categories ?? []}
        initial={{
          name: product.name,
          description: product.description ?? "",
          price: String(Number(product.price)),
          promo_price: product.promo_price === null ? "" : String(Number(product.promo_price)),
          category_id: product.category_id ?? "",
          sku: product.sku ?? "",
          track_stock: product.track_stock,
          stock: product.stock === null ? "" : String(product.stock),
          status: product.status,
          images: product.images ?? [],
          variants: (product.variants as unknown as ProductVariant[]) ?? [],
        }}
      />
    </PageContainer>
  );
}
