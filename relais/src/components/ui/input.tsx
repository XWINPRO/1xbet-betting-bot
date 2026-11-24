import * as React from "react";
import { cn } from "@/lib/utils";

export const fieldBase =
  "w-full rounded-md border border-line-strong bg-surface text-ink shadow-xs transition-[border-color,box-shadow] placeholder:text-ink-4 hover:border-ink-4/70 focus:border-accent focus:outline-none focus:shadow-focus disabled:cursor-not-allowed disabled:bg-subtle disabled:text-ink-3 aria-[invalid=true]:border-danger aria-[invalid=true]:focus:shadow-[0_0_0_3px_rgb(220_38_38/0.15)]";

export function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return <input type={type} className={cn(fieldBase, "h-9 px-3 text-[13.5px]", className)} {...props} />;
}

export function Textarea({ className, rows = 3, ...props }: React.ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(fieldBase, "min-h-[72px] px-3 py-2 text-[13.5px] leading-relaxed", className)} {...props} />;
}

export function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        fieldBase,
        "h-9 appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-9 pl-3 text-[13.5px]",
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23697586' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

/** Champ avec suffixe (ex. « FCFA », « km »). */
export function InputGroup({ suffix, prefix, className, ...props }: React.ComponentProps<"input"> & { suffix?: React.ReactNode; prefix?: React.ReactNode }) {
  return (
    <div className="relative flex items-center">
      {prefix ? <span className="pointer-events-none absolute left-3 text-[13px] text-ink-3">{prefix}</span> : null}
      <Input className={cn(prefix && "pl-9", suffix && "pr-14", className)} {...props} />
      {suffix ? <span className="pointer-events-none absolute right-3 text-xs font-medium text-ink-3">{suffix}</span> : null}
    </div>
  );
}
