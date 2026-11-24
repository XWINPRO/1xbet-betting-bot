import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  back,
  meta,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6", className)}>
      {back ? (
        <Link href={back.href} className="mb-3 inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink">
          <ChevronLeft className="size-3.5" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-xl font-semibold tracking-[-0.01em] text-ink">{title}</h1>
            {meta}
          </div>
          {description ? <p className="mt-1 max-w-2xl text-[13.5px] text-ink-3">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function PageContainer({ className, size = "default", ...props }: React.ComponentProps<"div"> & { size?: "default" | "narrow" | "wide" }) {
  const widths = { default: "max-w-[1240px]", narrow: "max-w-[860px]", wide: "max-w-[1480px]" };
  return <div className={cn("mx-auto w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8", widths[size], className)} {...props} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 text-center", compact ? "py-8" : "py-14", className)}>
      {icon ? (
        <div className="mb-3 flex size-10 items-center justify-center rounded-md border border-line bg-subtle text-ink-3 [&_svg]:size-[18px]">
          {icon}
        </div>
      ) : null}
      <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-ink-3">{description}</p> : null}
      {action ? <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}

/** Bandeau d'information contextuel. */
export function Notice({
  tone = "neutral",
  icon,
  title,
  children,
  className,
  action,
}: {
  tone?: "neutral" | "accent" | "warning" | "danger" | "success";
  icon?: React.ReactNode;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  const tones = {
    neutral: "border-line bg-subtle text-ink-2",
    accent: "border-accent/20 bg-accent-soft text-accent-ink",
    warning: "border-warning/25 bg-warning-soft text-warning-ink",
    danger: "border-danger/20 bg-danger-soft text-danger-ink",
    success: "border-success/20 bg-success-soft text-success",
  };
  return (
    <div className={cn("flex gap-3 rounded-md border px-3.5 py-3 text-[13px]", tones[tone], className)}>
      {icon ? <div className="mt-px shrink-0 [&_svg]:size-4">{icon}</div> : null}
      <div className="min-w-0 flex-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={cn("leading-relaxed", title ? "mt-0.5 opacity-90" : "")}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}

/** Bande de chiffres clés : cellules séparées par des filets, pas de cartes répétées. */
export function StatStrip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line shadow-xs sm:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] [&>*]:bg-surface",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  href,
  tone,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  href?: string;
  tone?: "default" | "warning" | "danger" | "success" | "accent";
}) {
  const toneClass = {
    default: "text-ink",
    warning: "text-warning-ink",
    danger: "text-danger-ink",
    success: "text-success",
    accent: "text-accent-ink",
  }[tone ?? "default"];
  const content = (
    <>
      <p className="text-xs font-medium text-ink-3">{label}</p>
      <p className={cn("mt-1.5 text-[22px] leading-7 font-semibold tracking-[-0.01em] tabular", toneClass)}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-3">{hint}</p> : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="block px-5 py-4 transition-colors hover:bg-subtle">
        {content}
      </Link>
    );
  }
  return <div className="px-5 py-4">{content}</div>;
}
