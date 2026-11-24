import Link from "next/link";
import { Brand } from "@/components/brand";
import { publicAssetUrl } from "@/lib/storage";

export function PublicHeader({ store }: { store?: { name: string; slug: string | null; logo_path: string | null } | null }) {
  const logo = publicAssetUrl(store?.logo_path);
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
        {store ? (
          <Link href={store.slug ? `/shop/${store.slug}` : "/"} className="flex items-center gap-2.5">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="size-7 rounded-md object-cover ring-1 ring-line" />
            ) : null}
            <span className="text-[15px] font-semibold">{store.name}</span>
          </Link>
        ) : (
          <Brand />
        )}
        <span className="text-xs text-ink-4">Suivi de livraison</span>
      </div>
    </header>
  );
}
