import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bike } from "lucide-react";
import { Brand } from "@/components/brand";
import { buttonVariants } from "@/components/ui/button";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { homePathFor, requireViewer } from "@/lib/auth";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Espace livreur") };
}

/** Compte sans profil livreur : l'accès livreur passe par une invitation. */
export default async function CourierWelcomePage() {
  const viewer = await requireViewer("/courier");
  if (viewer.courier) redirect("/courier");
  const { t } = await getI18n();
  const home = homePathFor(viewer);
  return (
    <div className="flex min-h-dvh flex-col items-center bg-canvas px-4 py-10">
      <div className="mb-8 flex w-full max-w-md items-center justify-between">
        <Brand href={home} />
        <LanguageSwitcher compact />
      </div>
      <div className="w-full max-w-md rounded-lg border border-line bg-surface p-6 shadow-xs">
        <span className="flex size-10 items-center justify-center rounded-md border border-line bg-subtle">
          <Bike className="size-5 text-ink-2" />
        </span>
        <h1 className="mt-4 text-lg font-semibold">{t("Ce compte n'est pas un compte livreur")}</h1>
        <p className="mt-1 text-[13.5px] text-ink-3">
          {t("L'espace livreur est réservé aux livreurs parrainés par un commerçant. Pour l'activer, ouvrez le lien d'invitation que votre commerçant vous a envoyé, connecté avec ce compte.")}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {home !== "/onboarding" ? (
            <Link href={home} className={buttonVariants({ variant: "primary" })}>
              {t("Retour à mon espace")}
            </Link>
          ) : null}
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
