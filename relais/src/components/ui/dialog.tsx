"use client";

import * as React from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  title,
  description,
  children,
  className,
  size = "md",
  footer,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  footer?: React.ReactNode;
}) {
  const { t } = useI18n();
  const widths = { sm: "max-w-[400px]", md: "max-w-[520px]", lg: "max-w-[680px]", xl: "max-w-[880px]" };
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-ink/30 data-[state=open]:animate-fade-in" />
      <D.Content
        className={cn(
          "fixed inset-x-3 bottom-3 z-50 mx-auto flex max-h-[calc(100dvh-24px)] flex-col overflow-hidden rounded-lg bg-surface shadow-pop data-[state=open]:animate-pop-in sm:inset-x-4 sm:top-[10vh] sm:bottom-auto sm:max-h-[80vh]",
          widths[size],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <D.Title className="text-[15px] font-semibold text-ink">{title}</D.Title>
            {description ? (
              <D.Description className="mt-0.5 text-[13px] text-ink-3">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{typeof title === "string" ? title : t("Fenêtre")}</D.Description>
            )}
          </div>
          <D.Close className="-mr-1 rounded-sm p-1 text-ink-3 hover:bg-muted hover:text-ink" aria-label={t("Fermer")}>
            <X className="size-4" />
          </D.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="flex items-center justify-end gap-2 border-t border-line bg-subtle px-5 py-3">{footer}</div> : null}
      </D.Content>
    </D.Portal>
  );
}
