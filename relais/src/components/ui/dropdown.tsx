"use client";

import * as React from "react";
import { DropdownMenu as M } from "radix-ui";
import { cn } from "@/lib/utils";

export const Dropdown = M.Root;
export const DropdownTrigger = M.Trigger;

export function DropdownContent({ className, align = "end", children, ...props }: React.ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={6}
        className={cn("z-50 min-w-[200px] rounded-md bg-surface p-1 shadow-pop data-[state=open]:animate-pop-in", className)}
        {...props}
      >
        {children}
      </M.Content>
    </M.Portal>
  );
}

export function DropdownItem({ className, destructive, ...props }: React.ComponentProps<typeof M.Item> & { destructive?: boolean }) {
  return (
    <M.Item
      className={cn(
        "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-[13px] text-ink-2 outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-muted data-[highlighted]:text-ink [&_svg]:size-4 [&_svg]:text-ink-3",
        destructive && "text-danger-ink data-[highlighted]:bg-danger-soft data-[highlighted]:text-danger-ink [&_svg]:text-danger-ink",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownLabel({ className, ...props }: React.ComponentProps<typeof M.Label>) {
  return <M.Label className={cn("px-2 pt-1.5 pb-1 text-[11px] font-medium tracking-wide text-ink-4 uppercase", className)} {...props} />;
}

export function DropdownSeparator() {
  return <M.Separator className="my-1 h-px bg-line" />;
}
