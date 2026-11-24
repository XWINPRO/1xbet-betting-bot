import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/components/brand";
import { homePathFor, requireViewer } from "@/lib/auth";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { AccountForms } from "./account-forms";

export const metadata = { title: "Mon compte" };

export default async function AccountPage() {
  const viewer = await requireViewer("/account");
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="flex h-14 items-center justify-between border-b border-line bg-surface px-5">
        <Brand href={homePathFor(viewer)} />
        <SignOutButton variant="ghost" />
      </header>
      <main className="mx-auto max-w-2xl px-5 py-8">
        <Link href={homePathFor(viewer)} className="mb-4 inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink">
          <ArrowLeft className="size-3.5" /> Retour
        </Link>
        <h1 className="mb-6 text-xl font-semibold tracking-[-0.01em]">Mon compte</h1>
        <AccountForms email={viewer.email} initial={{ full_name: viewer.profile.full_name, phone: viewer.profile.phone ?? "" }} />
      </main>
    </div>
  );
}
