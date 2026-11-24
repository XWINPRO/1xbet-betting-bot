import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { requireViewer } from "@/lib/auth";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { ApplyForm } from "./apply-form";

export const metadata = { title: "Devenir livreur" };

export default async function ApplyPage() {
  const viewer = await requireViewer("/courier/apply");
  if (viewer.courier) redirect("/courier");
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="flex h-14 items-center justify-between border-b border-line bg-surface px-4">
        <Brand />
        <SignOutButton variant="ghost" />
      </header>
      <main className="mx-auto max-w-lg px-4 py-8">
        <h1 className="text-xl font-semibold tracking-[-0.01em]">Devenir livreur du réseau</h1>
        <p className="mt-1 mb-6 text-[13.5px] text-ink-3">
          Recevez des demandes de livraison ponctuelles près de chez vous. Votre profil est vérifié par l&apos;administration avant activation.
        </p>
        <div className="rounded-lg border border-line bg-surface p-5 shadow-xs">
          <ApplyForm userId={viewer.id} defaults={{ full_name: viewer.profile.full_name, phone: viewer.profile.phone ?? "" }} />
        </div>
        <p className="mt-4 text-xs text-ink-4">
          Vous livrez pour une boutique précise ? Demandez-lui son lien d&apos;invitation : vous n&apos;avez pas besoin de candidater.
        </p>
      </main>
    </div>
  );
}
