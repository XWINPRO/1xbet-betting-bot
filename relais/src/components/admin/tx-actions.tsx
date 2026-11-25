"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { adminConfirmTransactionAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";

export function TransactionActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  async function act(status: "confirmed" | "failed") {
    setPending(status);
    const res = await adminConfirmTransactionAction(id, status);
    setPending(null);
    if (!res.ok) return toast.error(res.error);
    router.refresh();
  }
  return (
    <div className="flex justify-end gap-1">
      <Button size="xs" variant="success" loading={pending === "confirmed"} onClick={() => act("confirmed")}>
        Confirmer
      </Button>
      <Button size="xs" variant="ghost" loading={pending === "failed"} onClick={() => act("failed")}>
        Rejeter
      </Button>
    </div>
  );
}
