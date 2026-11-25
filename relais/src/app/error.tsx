"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-lg font-semibold">{t("Une erreur est survenue")}</h1>
      <p className="mt-1 max-w-sm text-[13.5px] text-ink-3">
        {t("L'opération n'a pas pu aboutir. Réessayez ; si le problème persiste, contactez le support.")}
        {error.digest ? ` (${t("code")} ${error.digest})` : ""}
      </p>
      <Button className="mt-6" onClick={() => reset()}>
        {t("Réessayer")}
      </Button>
    </main>
  );
}
