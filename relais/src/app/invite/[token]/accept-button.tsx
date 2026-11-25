"use client";

import * as React from "react";
import { acceptInvitationAction } from "@/lib/actions/invite";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/page";
import { useI18n } from "@/i18n/client";

export function AcceptInvitationButton({ token, label }: { token: string; label: string }) {
  const { t } = useI18n();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      {error ? <Notice tone="danger">{t(error)}</Notice> : null}
      <Button
        size="lg"
        variant="primary"
        block
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await acceptInvitationAction(token);
            if (res && !res.ok) setError(res.error);
          })
        }
      >
        {label}
      </Button>
    </div>
  );
}
