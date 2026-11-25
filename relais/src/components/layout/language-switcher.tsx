"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Locale; label: string; name: string }[] = [
  { value: "fr", label: "FR", name: "Français" },
  { value: "en", label: "EN", name: "English" },
];

/** Choix de la langue : mémorisé dans un cookie, appliqué à tout le site. */
export function LanguageSwitcher({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = next;
    startTransition(() => router.refresh());
  }

  return (
    <div
      role="group"
      aria-label={t("Langue")}
      className={cn("inline-flex items-center gap-0.5 rounded-md border border-line bg-surface p-0.5", pending && "opacity-60", className)}
    >
      {compact ? null : <Languages className="mx-1 size-3.5 text-ink-4" aria-hidden />}
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          lang={o.value}
          title={o.name}
          aria-pressed={locale === o.value}
          onClick={() => choose(o.value)}
          className={cn(
            "h-6 rounded-sm px-1.5 text-[11.5px] font-semibold tracking-wide transition-colors",
            locale === o.value ? "bg-ink text-white" : "text-ink-3 hover:bg-subtle hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
