import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer, homePathFor } from "@/lib/auth";
import { param } from "@/lib/utils";
import { LoginForm } from "./login-form";

export const metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = param(sp.next);
  const viewer = await getViewer();
  if (viewer) redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : homePathFor(viewer));
  return (
    <>
      <h1 className="text-xl font-semibold tracking-[-0.01em]">Connexion</h1>
      <p className="mt-1 mb-7 text-[13.5px] text-ink-3">Accédez à votre boutique, à votre espace livreur ou à l&apos;administration.</p>
      <LoginForm next={next} linkError={param(sp.error) === "link"} />
      <p className="mt-6 text-[13px] text-ink-3">
        Pas encore de compte ?{" "}
        <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-accent hover:underline">
          Créer un compte
        </Link>
      </p>
      <p className="mt-2 text-[13px] text-ink-3">
        Besoin d&apos;envoyer un colis ?{" "}
        <Link href="/delivery" className="font-medium text-ink hover:underline">
          Demander une livraison sans compte
        </Link>
      </p>
    </>
  );
}
