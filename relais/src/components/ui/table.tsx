import * as React from "react";
import { cn } from "@/lib/utils";

export function TableWrap({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("overflow-x-auto", className)}>{children}</div>;
}

export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return <table className={cn("w-full border-collapse text-[13.5px]", className)} {...props} />;
}

export function THead({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("bg-subtle", className)} {...props} />;
}

export function TH({ className, align, ...props }: React.ComponentProps<"th"> & { align?: "left" | "right" | "center" }) {
  return (
    <th
      className={cn(
        "h-9 border-b border-line px-4 text-left text-xs font-medium whitespace-nowrap text-ink-3 first:pl-5 last:pr-5",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    />
  );
}

export function TR({ className, interactive, ...props }: React.ComponentProps<"tr"> & { interactive?: boolean }) {
  return (
    <tr
      className={cn("border-b border-line last:border-0", interactive && "cursor-pointer transition-colors hover:bg-subtle", className)}
      {...props}
    />
  );
}

export function TD({ className, align, ...props }: React.ComponentProps<"td"> & { align?: "left" | "right" | "center" }) {
  return (
    <td
      className={cn(
        "h-12 px-4 align-middle text-ink first:pl-5 last:pr-5",
        align === "right" && "text-right tabular",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    />
  );
}
