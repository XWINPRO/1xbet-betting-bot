"use client";

import * as React from "react";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { courierDocumentUrlAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";

export function DocumentButton({ path }: { path: string }) {
  const [pending, setPending] = React.useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={pending}
      onClick={async () => {
        setPending(true);
        const url = await courierDocumentUrlAction(path);
        setPending(false);
        if (!url) return toast.error("Document inaccessible.");
        window.open(url, "_blank", "noopener,noreferrer");
      }}
    >
      <FileText /> Pièce
    </Button>
  );
}
