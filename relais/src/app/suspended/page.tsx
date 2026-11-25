import type { Metadata } from "next";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Compte suspendu") };
}

export default async function SuspendedPage() {
  const { t } = await getI18n();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Brand className="mb-10" />
      <h1 className="text-lg font-semibold">{t("Compte suspendu")}</h1>
      <p className="mt-1 max-w-sm text-[13.5px] text-ink-3">
        {t("L'accès à votre compte a été suspendu par l'administration de la plateforme. Contactez le support pour plus d'informations.")}
      </p>
      <div className="mt-6">
        <SignOutButton />
      </div>
    </main>
  );
}
