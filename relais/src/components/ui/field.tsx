"use client";

import * as React from "react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-[13px] font-medium text-ink-2", className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  className,
  children,
}: {
  label?: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string | null;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <Label htmlFor={htmlFor}>
          {label}
          {optional ? <span className="ml-1 font-normal text-ink-4">{t("facultatif")}</span> : null}
        </Label>
      ) : null}
      {children}
      {error ? (
        <p className="text-xs text-danger-ink" role="alert">
          {t(error)}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormSection({
  title,
  description,
  children,
  className,
  aside,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  aside?: React.ReactNode;
}) {
  return (
    <section className={cn("grid gap-x-10 gap-y-4 border-b border-line py-7 first:pt-0 last:border-0 md:grid-cols-[240px_1fr]", className)}>
      <div>
        <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{description}</p> : null}
        {aside}
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}
