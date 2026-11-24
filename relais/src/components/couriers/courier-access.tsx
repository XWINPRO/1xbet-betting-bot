"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2, ShieldOff, ShieldCheck } from "lucide-react";
import { regenerateCourierInviteAction, setCourierAccessAction } from "@/lib/actions/couriers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CopyButton } from "@/components/ui/client-helpers";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { whatsappUrl, waMessages } from "@/lib/whatsapp";

export function CourierAccessButton({ courierId, active }: { courierId: string; active: boolean }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  return (
    <Button
      size="sm"
      variant={active ? "danger-ghost" : "secondary"}
      loading={pending}
      onClick={async () => {
        setPending(true);
        const res = await setCourierAccessAction(courierId, !active);
        setPending(false);
        if (!res.ok) return toast.error(res.error);
        toast.success(res.message ?? "Mis à jour.");
        router.refresh();
      }}
    >
      {active ? <ShieldOff /> : <ShieldCheck />}
      {active ? "Suspendre l'accès" : "Réactiver l'accès"}
    </Button>
  );
}

export function CourierInviteButton({ courierId, phone, storeName }: { courierId: string; phone: string; storeName: string }) {
  const [open, setOpen] = React.useState(false);
  const [url, setUrl] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        size="sm"
        variant="secondary"
        loading={pending}
        onClick={async () => {
          setPending(true);
          const res = await regenerateCourierInviteAction(courierId);
          setPending(false);
          if (!res.ok) return toast.error(res.error);
          setUrl(res.data.inviteUrl);
          setOpen(true);
        }}
      >
        <Link2 /> Lien d&apos;activation
      </Button>
      <DialogContent title="Nouveau lien d'activation" description="Les liens précédents sont révoqués. Valable 7 jours." size="md">
        {url ? (
          <div className="rounded-md border border-line bg-subtle p-3">
            <p className="truncate font-mono text-xs text-ink-2">{url}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <CopyButton value={url} label="Copier" />
              <WhatsAppButton size="sm" label="Envoyer par WhatsApp" href={whatsappUrl(phone, waMessages.courierInvite({ storeName, url }))} />
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
