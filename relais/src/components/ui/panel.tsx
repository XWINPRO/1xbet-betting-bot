import * as React from "react";
import { cn } from "@/lib/utils";

/** Surface de contenu : bordure fine, pas d'ombre lourde. */
export function Panel({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-lg border border-line bg-surface shadow-xs", className)} {...props} />;
}

export function PanelHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5", className)}>
      <div className="min-w-0">
        <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-[12.5px] text-ink-3">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function PanelBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

export function PanelFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center justify-end gap-2 border-t border-line bg-subtle px-5 py-3 rounded-b-lg", className)} {...props} />;
}

/** Liste de paires libellé / valeur. */
export function DescriptionList({ items, className }: { items: { label: React.ReactNode; value: React.ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-line", className)}>
      {items.map((item, i) => (
        <div key={i} className="grid grid-cols-[minmax(110px,40%)_1fr] gap-3 py-2.5 text-[13.5px]">
          <dt className="text-ink-3">{item.label}</dt>
          <dd className="min-w-0 text-ink break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
