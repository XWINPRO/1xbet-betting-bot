"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Avatar } from "@/components/ui/avatar";
import { switchStoreAction } from "@/lib/actions/store-context";

export type SwitcherStore = { id: string; name: string; role: "owner" | "staff"; logoUrl: string | null };

export function StoreSwitcher({ stores, activeId }: { stores: SwitcherStore[]; activeId: string }) {
  const active = stores.find((s) => s.id === activeId) ?? stores[0];
  return (
    <Dropdown>
      <DropdownTrigger className="flex w-full items-center gap-2.5 rounded-md border border-line bg-surface px-2 py-1.5 text-left shadow-xs hover:bg-subtle focus-visible:outline-none focus-visible:shadow-focus">
        <Avatar name={active?.name} src={active?.logoUrl} size={24} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-ink">{active?.name}</span>
          <span className="block text-[11px] text-ink-3">{active?.role === "owner" ? "Propriétaire" : "Équipe"}</span>
        </span>
        <ChevronsUpDown className="size-3.5 text-ink-4" />
      </DropdownTrigger>
      <DropdownContent align="start" className="w-[232px]">
        <DropdownLabel>Boutiques</DropdownLabel>
        {stores.map((s) => (
          <form key={s.id} action={switchStoreAction}>
            <input type="hidden" name="store_id" value={s.id} />
            <DropdownItem asChild>
              <button type="submit" className="w-full">
                <Avatar name={s.name} src={s.logoUrl} size={18} />
                <span className="flex-1 truncate text-left">{s.name}</span>
                {s.id === active?.id ? <Check className="!text-accent" /> : null}
              </button>
            </DropdownItem>
          </form>
        ))}
        <DropdownSeparator />
        <DropdownItem asChild>
          <Link href="/onboarding?new=1">
            <Plus /> Créer une boutique
          </Link>
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}
