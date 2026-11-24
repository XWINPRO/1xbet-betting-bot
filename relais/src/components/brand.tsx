import Link from "next/link";
import { cn } from "@/lib/utils";
import { env } from "@/lib/env";

/** Marque : un trajet A → B dans un carré, la signature du produit. */
export function LogoMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={cn("shrink-0", className)} aria-hidden>
      <rect width="24" height="24" rx="6" fill="#17202C" />
      <path d="M7.5 7.5h5.25a3.75 3.75 0 0 1 3.75 3.75v5.25" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <circle cx="7.5" cy="7.5" r="2" fill="#fff" />
      <circle cx="16.5" cy="16.5" r="2.25" fill="#3B82F6" stroke="#17202C" strokeWidth="0.75" />
    </svg>
  );
}

export function Brand({ href = "/", className, size = "md" }: { href?: string; className?: string; size?: "sm" | "md" | "lg" }) {
  const dims = { sm: 20, md: 22, lg: 28 }[size];
  const text = { sm: "text-[14px]", md: "text-[15px]", lg: "text-[19px]" }[size];
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-semibold tracking-[-0.015em] text-ink", text, className)}>
      <LogoMark size={dims} />
      {env.appName}
    </Link>
  );
}
