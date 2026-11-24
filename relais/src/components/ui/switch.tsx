"use client";

import * as React from "react";
import { Switch as S, Checkbox as C } from "radix-ui";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: React.ComponentProps<typeof S.Root>) {
  return (
    <S.Root
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-line-strong transition-colors data-[state=checked]:bg-accent disabled:cursor-not-allowed disabled:opacity-50 focus-visible:shadow-focus focus-visible:outline-none",
        className,
      )}
      {...props}
    >
      <S.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[18px]" />
    </S.Root>
  );
}

export function Checkbox({ className, ...props }: React.ComponentProps<typeof C.Root>) {
  return (
    <C.Root
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-xs border border-line-strong bg-surface shadow-xs data-[state=checked]:border-accent data-[state=checked]:bg-accent focus-visible:shadow-focus focus-visible:outline-none",
        className,
      )}
      {...props}
    >
      <C.Indicator>
        <Check className="size-3 text-white" strokeWidth={3} />
      </C.Indicator>
    </C.Root>
  );
}

export function ToggleRow({
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
  id,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  id: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-[13.5px] font-medium text-ink">{title}</span>
        {description ? <span className="mt-0.5 block text-[13px] text-ink-3">{description}</span> : null}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}
