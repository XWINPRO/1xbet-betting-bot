import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/layout/sign-out-button";

export const metadata = { title: "Compte suspendu" };

export default function SuspendedPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Brand className="mb-10" />
      <h1 className="text-lg font-semibold">Compte suspendu</h1>
      <p className="mt-1 max-w-sm text-[13.5px] text-ink-3">
        L&apos;accès à votre compte a été suspendu par l&apos;administration de la plateforme. Contactez le support pour plus d&apos;informations.
      </p>
      <div className="mt-6">
        <SignOutButton />
      </div>
    </main>
  );
}
