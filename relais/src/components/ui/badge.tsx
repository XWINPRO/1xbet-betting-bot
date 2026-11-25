"use client";

import * as React from "react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/status";

const toneClasses: Record<Tone, { box: string; dot: string }> = {
  neutral: { box: "bg-muted text-ink-2", dot: "bg-ink-3" },
  accent: { box: "bg-accent-soft text-accent-ink", dot: "bg-accent" },
  success: { box: "bg-success-soft text-success", dot: "bg-success" },
  warning: { box: "bg-warning-soft text-warning-ink", dot: "bg-warning" },
  danger: { box: "bg-danger-soft text-danger-ink", dot: "bg-danger" },
  muted: { box: "bg-subtle text-ink-3 ring-1 ring-inset ring-line", dot: "bg-ink-4" },
};

export function Badge({
  tone = "neutral",
  dot = true,
  pulse = false,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const t = toneClasses[tone];
  return (
    <span className={cn("inline-flex h-[22px] items-center gap-1.5 rounded-sm px-2 text-xs font-medium whitespace-nowrap", t.box, className)}>
      {dot ? <span className={cn("size-1.5 rounded-full", t.dot, pulse && "animate-pulse-dot")} aria-hidden /> : null}
      {children}
    </span>
  );
}

export function StatusBadge<T extends string>({
  map,
  value,
  pulse,
  className,
}: {
  map: Record<T, { label: string; tone: Tone }>;
  value: T | null | undefined;
  pulse?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const meta = value && value in map ? map[value] : { label: value ?? "—", tone: "neutral" as Tone };
  return (
    <Badge tone={meta.tone} pulse={pulse} className={className}>
      {t(meta.label)}
    </Badge>
  );
}

/** Étiquette neutre sans pastille (source, catégorie…). */
export function Tag({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex h-5 items-center rounded-xs border border-line bg-surface px-1.5 text-[11.5px] font-medium text-ink-2", className)}>
      {children}
    </span>
  );
}
