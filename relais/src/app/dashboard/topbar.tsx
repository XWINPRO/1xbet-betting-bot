"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Plus, Search } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export function DashboardTopbar({ shopUrl, canCreateOrder }: { shopUrl: string | null; canCreateOrder: boolean }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  return (
    <>
      <form
        className="relative mr-auto hidden w-full max-w-xs md:block"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`/dashboard/orders${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
        }}
      >
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-4" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Commande, client, téléphone…"
          aria-label="Rechercher une commande"
          className="h-8 w-full rounded-md border border-line bg-subtle pr-3 pl-8 text-[13px] placeholder:text-ink-4 focus:border-accent focus:bg-surface focus:shadow-focus focus:outline-none"
        />
      </form>
      {shopUrl ? (
        <Link href={shopUrl} target="_blank" className={buttonVariants({ variant: "ghost", size: "sm", className: "hidden sm:inline-flex" })}>
          Boutique publique <ExternalLink />
        </Link>
      ) : null}
      {canCreateOrder ? (
        <Button asChild variant="primary" size="sm">
          <Link href="/dashboard/orders/new">
            <Plus /> Nouvelle commande
          </Link>
        </Button>
      ) : null}
    </>
  );
}
