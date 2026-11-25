"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Banknote, UserMinus, Users, XCircle } from "lucide-react";
import { adminAssignCourierAction, adminCancelJobAction, adminRecordJobPaymentAction, adminUnassignAction } from "@/lib/actions/admin";
import { CourierPicker } from "@/components/delivery/courier-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, InputGroup, NativeSelect, Textarea } from "@/components/ui/input";
import type { LatLng } from "@/lib/geo";
import type { BoardCourier, JobStatus } from "@/types/domain";

export function JobAdminActions({
  jobId,
  status,
  courierId,
  couriers,
  pickup,
  staleAfterSeconds,
  source,
  price,
  paymentStatus,
}: {
  jobId: string;
  status: JobStatus;
  courierId: string | null;
  couriers: BoardCourier[];
  pickup: LatLng | null;
  staleAfterSeconds: number;
  source: "store_order" | "on_demand";
  price: number;
  paymentStatus: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState<"assign" | "cancel" | "pay" | null>(null);
  const [pending, setPending] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState("");
  const [pay, setPay] = React.useState({ amount: String(price), method: "cash_on_delivery", reference: "" });
  const closed = ["delivered", "failed", "cancelled"].includes(status);

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setPending(key);
    const res = await fn();
    setPending(null);
    if (!res.ok) return toast.error(res.error ?? "Erreur");
    toast.success(res.message ?? "Fait.");
    setOpen(null);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {["pending", "offered", "accepted"].includes(status) ? (
        <Button variant={courierId ? "secondary" : "primary"} size="sm" onClick={() => setOpen("assign")}>
          <Users /> {courierId ? "Réattribuer" : "Attribuer un livreur"}
        </Button>
      ) : null}
      {["offered", "accepted"].includes(status) ? (
        <Button size="sm" variant="ghost" loading={pending === "unassign"} onClick={() => run("unassign", () => adminUnassignAction(jobId))}>
          <UserMinus /> Retirer le livreur
        </Button>
      ) : null}
      {source === "on_demand" && paymentStatus !== "paid" ? (
        <Button size="sm" variant="secondary" onClick={() => setOpen("pay")}>
          <Banknote /> Enregistrer un paiement
        </Button>
      ) : null}
      {!closed ? (
        <Button size="sm" variant="danger-ghost" onClick={() => setOpen("cancel")}>
          <XCircle /> Annuler la course
        </Button>
      ) : null}

      <Dialog open={open === "assign"} onOpenChange={(o) => setOpen(o ? "assign" : null)}>
        <DialogContent size="lg" title="Attribuer un livreur du réseau" description="Le livreur reçoit la proposition et doit l'accepter.">
          <CourierPicker couriers={couriers} pickup={pickup} staleAfterSeconds={staleAfterSeconds} currentCourierId={courierId} pendingId={pending} onPick={(id) => run(id, () => adminAssignCourierAction(jobId, id))} />
        </DialogContent>
      </Dialog>

      <Dialog open={open === "cancel"} onOpenChange={(o) => setOpen(o ? "cancel" : null)}>
        <DialogContent
          size="sm"
          title="Annuler la course"
          footer={
            <Button variant="danger" loading={pending === "cancel"} disabled={reason.trim().length < 3} onClick={() => run("cancel", () => adminCancelJobAction(jobId, reason))}>
              Annuler la course
            </Button>
          }
        >
          <Field label="Motif" htmlFor="adm-cancel">
            <Textarea id="adm-cancel" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "pay"} onOpenChange={(o) => setOpen(o ? "pay" : null)}>
        <DialogContent
          size="sm"
          title="Enregistrer un paiement"
          description="Paiement réellement reçu (espèces ou mobile money vérifié)."
          footer={
            <Button variant="primary" loading={pending === "pay"} onClick={() => run("pay", () => adminRecordJobPaymentAction(jobId, Number(pay.amount), pay.method, pay.reference))}>
              Enregistrer
            </Button>
          }
        >
          <div className="flex flex-col gap-4">
            <Field label="Montant" htmlFor="adm-amount">
              <InputGroup id="adm-amount" type="number" min={1} suffix="FCFA" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
            </Field>
            <Field label="Moyen" htmlFor="adm-method">
              <NativeSelect id="adm-method" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
                <option value="cash_on_delivery">Espèces</option>
                <option value="orange_money">Orange Money</option>
                <option value="mtn_momo">MTN MoMo</option>
                <option value="manual">Virement ou dépôt</option>
              </NativeSelect>
            </Field>
            <Field label="Référence" htmlFor="adm-ref" optional>
              <Input id="adm-ref" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} />
            </Field>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
