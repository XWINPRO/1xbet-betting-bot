import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer, homePathFor } from "@/lib/auth";
import { param } from "@/lib/utils";
import { getI18n } from "@/i18n/server";
import { SignupForm } from "./signup-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Créer un compte") };
}

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const viewer = await getViewer();
  if (viewer) redirect(homePathFor(viewer));
  const { t } = await getI18n();
  const next = param(sp.next);
  // Les livreurs et employés arrivent ici depuis leur lien d'invitation.
  const invited = Boolean(next?.startsWith("/invite/"));
  return (
    <>
      <h1 className="text-xl font-semibold tracking-[-0.01em]">{invited ? t("Activer votre accès") : t("Créer un compte commerçant")}</h1>
      <p className="mt-1 mb-7 text-[13.5px] text-ink-3">
        {invited
          ? t("Créez votre compte pour rejoindre l'équipe qui vous a invité.")
          : t("Créez votre compte, puis votre boutique. Vous pourrez ensuite inviter vos livreurs.")}
      </p>
      <SignupForm next={next} />
      <p className="mt-6 text-[13px] text-ink-3">
        {t("Déjà inscrit ?")}{" "}
        <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-accent hover:underline">
          {t("Se connecter")}
        </Link>
      </p>
      {invited ? null : (
        <p className="mt-2 text-[13px] text-ink-3">
          {t("Vous êtes livreur ? Utilisez le lien d'invitation envoyé par votre commerçant.")}
        </p>
      )}
    </>
  );
}
