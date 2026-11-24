"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-lg font-semibold">Une erreur est survenue</h1>
      <p className="mt-1 max-w-sm text-[13.5px] text-ink-3">
        L&apos;opération n&apos;a pas pu aboutir. Réessayez ; si le problème persiste, contactez le support
        {error.digest ? ` (code ${error.digest})` : ""}.
      </p>
      <Button className="mt-6" onClick={() => reset()}>
        Réessayer
      </Button>
    </main>
  );
}
