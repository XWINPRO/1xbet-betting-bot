"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import type { ActionResult } from "@/lib/errors";

/** Bouton d'action d'administration avec confirmation et motif facultatif/obligatoire. */
export function ConfirmAction({
  label,
  title,
  description,
  confirmLabel,
  variant = "secondary",
  size = "sm",
  reason,
  action,
}: {
  label: React.ReactNode;
  title: string;
  description?: string;
  confirmLabel: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  reason?: "optional" | "required";
  action: (reason: string) => Promise<ActionResult<unknown>>;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [pending, setPending] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <DialogContent
        size="sm"
        title={title}
        description={description}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              variant={variant === "danger" || variant === "danger-ghost" ? "danger" : "primary"}
              loading={pending}
              disabled={reason === "required" && text.trim().length < 3}
              onClick={async () => {
                setPending(true);
                const res = await action(text);
                setPending(false);
                if (!res.ok) return toast.error(res.error);
                toast.success(res.message ?? "Fait.");
                setOpen(false);
                setText("");
                router.refresh();
              }}
            >
              {confirmLabel}
            </Button>
          </>
        }
      >
        {reason ? (
          <Field label={reason === "required" ? "Motif" : "Note"} htmlFor="confirm-reason" optional={reason === "optional"}>
            <Textarea id="confirm-reason" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
        ) : (
          <p className="text-[13px] text-ink-3">Confirmez pour continuer.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
