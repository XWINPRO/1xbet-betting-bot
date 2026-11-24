"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, House, User } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/courier", label: "Accueil", icon: House, exact: true },
  { href: "/courier/history", label: "Historique", icon: History },
  { href: "/courier/profile", label: "Profil", icon: User },
];

export function CourierBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm" aria-label="Navigation livreur">
      <ul className="mx-auto grid max-w-xl grid-cols-3">
        {ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined} className={cn("flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active ? "text-ink" : "text-ink-3")}>
                <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
