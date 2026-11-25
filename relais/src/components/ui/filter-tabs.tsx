"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

/** Onglets de filtre sous forme de liens (état dans l'URL). */
export function FilterTabs({
  items,
  active,
  className,
}: {
  items: { key: string; label: string; href: string; count?: number | null }[];
  active: string;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <nav className={cn("-mb-px flex gap-1 overflow-x-auto", className)} aria-label={t("Filtres")}>
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-[13px] font-medium whitespace-nowrap transition-colors",
              isActive ? "border-ink text-ink" : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            {item.label}
            {item.count !== undefined && item.count !== null ? (
              <span className={cn("rounded-xs px-1.5 text-[11px] tabular", isActive ? "bg-ink text-white" : "bg-muted text-ink-3")}>
                {item.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
