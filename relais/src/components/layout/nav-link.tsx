"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Banknote,
  Bike,
  ChartColumn,
  ClipboardList,
  History,
  LayoutGrid,
  MessageSquareWarning,
  Package,
  Receipt,
  Settings,
  ShoppingBag,
  Store,
  Tags,
  Truck,
  User,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Les icônes sont désignées par nom : un composant ne peut pas transiter du serveur au client. */
const ICONS = {
  overview: LayoutGrid,
  orders: ShoppingBag,
  products: Package,
  customers: Users,
  deliveries: Truck,
  couriers: Bike,
  storefront: Store,
  stats: ChartColumn,
  settings: Settings,
  users: User,
  payments: Banknote,
  pricing: Tags,
  claims: MessageSquareWarning,
  logs: History,
  activity: Activity,
  receipt: Receipt,
  jobs: ClipboardList,
} as const;

export type NavIcon = keyof typeof ICONS;
export type NavItem = { href: string; label: string; icon: NavIcon; exact?: boolean; badge?: number | null };

export function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-px">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = ICONS[item.icon];
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] transition-colors",
                active ? "bg-muted font-medium text-ink" : "text-ink-2 hover:bg-subtle hover:text-ink",
              )}
            >
              <Icon className={cn("size-4 shrink-0", active ? "text-ink" : "text-ink-3 group-hover:text-ink-2")} strokeWidth={active ? 2.1 : 1.8} />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge ? (
                <span className="min-w-5 rounded-xs bg-accent px-1 text-center text-[11px] leading-[18px] font-semibold text-white tabular">{item.badge}</span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
