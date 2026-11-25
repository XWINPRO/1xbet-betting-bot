import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/components/brand";
import { homePathFor, requireViewer } from "@/lib/auth";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { AccountForms } from "./account-forms";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { getI18n } from "@/i18n/server";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Mon compte") };
}

export default async function AccountPage() {
  const viewer = await requireViewer("/account");
  const { t } = await getI18n();
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="flex h-14 items-center justify-between gap-3 border-b border-line bg-surface px-4 sm:px-5">
        <Brand href={homePathFor(viewer)} />
        <div className="flex items-center gap-2">
          <LanguageSwitcher compact />
          <SignOutButton variant="ghost" />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-5">
        <Link href={homePathFor(viewer)} className="mb-4 inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink">
          <ArrowLeft className="size-3.5" /> {t("Retour")}
        </Link>
        <h1 className="mb-6 text-xl font-semibold tracking-[-0.01em]">{t("Mon compte")}</h1>
        <AccountForms email={viewer.email} initial={{ full_name: viewer.profile.full_name, phone: viewer.profile.phone ?? "" }} />
      </main>
    </div>
  );
}
