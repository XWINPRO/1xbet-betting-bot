"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateClaimAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { NativeSelect, Textarea } from "@/components/ui/input";
import { CLAIM_STATUS } from "@/lib/status";
import type { ClaimStatus } from "@/types/domain";

export function ClaimEditor({ id, status, resolution }: { id: string; status: ClaimStatus; resolution: string | null }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [v, setV] = React.useState({ status, resolution: resolution ?? "" });
  const [pending, setPending] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Traiter
      </Button>
      <DialogContent
        size="sm"
        title="Traiter la réclamation"
        footer={
          <Button
            variant="primary"
            loading={pending}
            onClick={async () => {
              setPending(true);
              const res = await updateClaimAction(id, v.status, v.resolution);
              setPending(false);
              if (!res.ok) return toast.error(res.error);
              setOpen(false);
              router.refresh();
            }}
          >
            Enregistrer
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Statut" htmlFor="cl-status">
            <NativeSelect id="cl-status" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as ClaimStatus })}>
              {Object.entries(CLAIM_STATUS).map(([k, m]) => (
                <option key={k} value={k}>
                  {m.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Résolution" htmlFor="cl-res" optional>
            <Textarea id="cl-res" rows={3} value={v.resolution} onChange={(e) => setV({ ...v, resolution: e.target.value })} />
          </Field>
        </div>
      </DialogContent>
    </Dialog>
  );
}
