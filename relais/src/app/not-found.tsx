import Link from "next/link";
import { Brand } from "@/components/brand";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Brand className="mb-10" />
      <p className="font-mono text-xs text-ink-3">404</p>
      <h1 className="mt-2 text-lg font-semibold">Page introuvable</h1>
      <p className="mt-1 max-w-sm text-[13.5px] text-ink-3">Le lien est peut-être incomplet, expiré, ou vous n&apos;avez pas accès à cette ressource.</p>
      <Link href="/" className={buttonVariants({ variant: "secondary", className: "mt-6" })}>
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
