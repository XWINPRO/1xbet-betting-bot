import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bike } from "lucide-react";
import { getViewer, homePathFor } from "@/lib/auth";
import { param } from "@/lib/utils";
import { getI18n } from "@/i18n/server";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Connexion") };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = param(sp.next);
  const viewer = await getViewer();
  if (viewer) redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : homePathFor(viewer));
  const { t } = await getI18n();
  const courier = Boolean(next?.startsWith("/courier"));
  return (
    <>
      {courier ? (
        <span className="mb-3 flex size-9 items-center justify-center rounded-md border border-line bg-subtle">
          <Bike className="size-4.5 text-ink-2" />
        </span>
      ) : null}
      <h1 className="text-xl font-semibold tracking-[-0.01em]">{courier ? t("Espace livreur") : t("Connexion")}</h1>
      <p className="mt-1 mb-7 text-[13.5px] text-ink-3">
        {courier
          ? t("Connectez-vous avec le compte créé à partir du lien d'invitation de votre commerçant.")
          : t("Accédez à votre boutique, à votre espace livreur ou à l'administration.")}
      </p>
      <LoginForm next={next} linkError={param(sp.error) === "link"} />
      {courier ? (
        <p className="mt-6 text-[13px] text-ink-3">
          {t("Pas encore d'accès ? Les livreurs ne s'inscrivent pas eux-mêmes : demandez à votre commerçant de vous envoyer un lien d'invitation.")}
        </p>
      ) : (
        <>
          <p className="mt-6 text-[13px] text-ink-3">
            {t("Pas encore de compte ?")}{" "}
            <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-accent hover:underline">
              {t("Créer un compte commerçant")}
            </Link>
          </p>
          <p className="mt-2 text-[13px] text-ink-3">
            {t("Vous êtes livreur ?")}{" "}
            <Link href="/login?next=/courier" className="font-medium text-ink hover:underline">
              {t("Espace livreur")}
            </Link>
          </p>
        </>
      )}
    </>
  );
}
