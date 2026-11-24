"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, Copy, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SubmitButton({ children, pendingLabel, ...props }: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} {...props}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

export function CopyButton({ value, label = "Copier", copiedLabel = "Copié", size = "sm", variant = "secondary", className, iconOnly }: {
  value: string;
  label?: string;
  copiedLabel?: string;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  className?: string;
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = React.useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Copie impossible. Sélectionnez le texte manuellement.");
    }
  }
  return (
    <Button type="button" size={iconOnly ? "icon" : size} variant={variant} onClick={copy} className={className} aria-label={iconOnly ? label : undefined}>
      {copied ? <Check className="text-success" /> : <Copy />}
      {iconOnly ? null : copied ? copiedLabel : label}
    </Button>
  );
}

/** Champ de recherche synchronisé avec le paramètre ?q= de l'URL. */
export function SearchInput({ placeholder = "Rechercher…", param = "q", className }: { placeholder?: string; param?: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = React.useState(searchParams.get(param) ?? "");
  const [, startTransition] = React.useTransition();
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  function apply(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set(param, next);
    else params.delete(param);
    params.delete("page");
    startTransition(() => router.replace(`${pathname}${params.size ? `?${params.toString()}` : ""}`));
  }

  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-4" />
      <Input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pr-8 pl-8"
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => apply(next.trim()), 300);
        }}
      />
      {value ? (
        <button
          type="button"
          aria-label="Effacer"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-xs p-0.5 text-ink-4 hover:text-ink"
          onClick={() => {
            setValue("");
            apply("");
          }}
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

/** Sélecteur relié à un paramètre d'URL. */
export function ParamSelect({ param, options, className, label }: { param: string; options: { value: string; label: string }[]; className?: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(param) ?? "";
  return (
    <select
      aria-label={label}
      value={current}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        if (e.target.value) params.set(param, e.target.value);
        else params.delete(param);
        params.delete("page");
        router.replace(`${pathname}${params.size ? `?${params.toString()}` : ""}`);
      }}
      className={cn(
        "h-9 rounded-md border border-line-strong bg-surface pr-8 pl-3 text-[13px] text-ink shadow-xs focus:border-accent focus:shadow-focus focus:outline-none",
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Rafraîchit la page serveur à intervalle régulier (données de suivi). */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  React.useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}

/** Heure relative mise à jour côté client (évite les écarts d'hydratation). */
export function RelativeTime({ value, className }: { value: string | null | undefined; className?: string }) {
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  if (!value) return <span className={className}>—</span>;
  const d = new Date(value);
  const title = d.toLocaleString("fr-FR");
  if (!now) return <span className={className} title={title}>…</span>;
  const s = Math.round((now.getTime() - d.getTime()) / 1000);
  let label: string;
  if (s < 45) label = "à l'instant";
  else if (s < 3600) label = `il y a ${Math.max(1, Math.round(s / 60))} min`;
  else if (s < 86400) label = `il y a ${Math.round(s / 3600)} h`;
  else label = `il y a ${Math.round(s / 86400)} j`;
  return (
    <time dateTime={value} title={title} className={className}>
      {label}
    </time>
  );
}
