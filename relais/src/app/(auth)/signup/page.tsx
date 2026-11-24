import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer, homePathFor } from "@/lib/auth";
import { param } from "@/lib/utils";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Créer un compte" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const viewer = await getViewer();
  if (viewer) redirect(homePathFor(viewer));
  const next = param(sp.next);
  return (
    <>
      <h1 className="text-xl font-semibold tracking-[-0.01em]">Créer un compte</h1>
      <p className="mt-1 mb-7 text-[13.5px] text-ink-3">Quelques informations suffisent pour démarrer.</p>
      <SignupForm next={next} defaultIntent={param(sp.intent)} />
      <p className="mt-6 text-[13px] text-ink-3">
        Déjà inscrit ?{" "}
        <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-accent hover:underline">
          Se connecter
        </Link>
      </p>
    </>
  );
}
