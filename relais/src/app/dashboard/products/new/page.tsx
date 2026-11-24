import { requireStorePermission } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { ProductForm } from "@/components/products/product-form";

export const metadata = { title: "Nouveau produit" };

export default async function NewProductPage() {
  const ctx = await requireStorePermission("products.manage");
  const supabase = await createSupabaseServerClient();
  const { data: categories } = await supabase.from("product_categories").select("id, name").eq("store_id", ctx.storeId).order("position");
  return (
    <PageContainer>
      <PageHeader title="Nouveau produit" back={{ href: "/dashboard/products", label: "Produits" }} />
      <ProductForm
        storeId={ctx.storeId}
        productId={null}
        categories={categories ?? []}
        initial={{ name: "", description: "", price: "", promo_price: "", category_id: "", sku: "", track_stock: false, stock: "", status: "active", images: [], variants: [] }}
      />
    </PageContainer>
  );
}
