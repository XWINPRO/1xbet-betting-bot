"use client";

import { useI18n } from "@/i18n/client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, ChevronDown } from "lucide-react";
import { setOrderStatusAction } from "@/lib/actions/orders";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { ORDER_ACTION_LABEL, ORDER_TRANSITIONS } from "@/lib/status";
import type { OrderStatus } from "@/types/domain";

const PRIMARY_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  new: "confirmed",
  confirmed: "preparing",
  preparing: "ready_for_pickup",
  delivery_failed: "ready_for_pickup",
};

export function OrderStatusActions({
  orderId,
  status,
  canEdit,
  hasActiveJob,
  deliveryMode,
}: {
  orderId: string;
  status: OrderStatus;
  canEdit: boolean;
  hasActiveJob: boolean;
  deliveryMode: "delivery" | "pickup";
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, setPending] = React.useState<OrderStatus | null>(null);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");

  if (!canEdit) return null;
  const allowed = ORDER_TRANSITIONS[status].filter((s) => {
    if (s === "cancelled") return false;
    if (hasActiveJob && ["handed_to_courier", "in_transit", "delivered", "delivery_failed"].includes(s)) return false;
    if (deliveryMode === "pickup" && ["handed_to_courier", "in_transit", "delivery_failed"].includes(s)) return false;
    return true;
  });
  const primary = PRIMARY_NEXT[status] && allowed.includes(PRIMARY_NEXT[status]!) ? PRIMARY_NEXT[status]! : deliveryMode === "pickup" && allowed.includes("delivered") && status === "ready_for_pickup" ? "delivered" : null;
  const others = allowed.filter((s) => s !== primary);
  const canCancel = ORDER_TRANSITIONS[status].includes("cancelled");

  async function run(next: OrderStatus, note?: string) {
    setPending(next);
    const res = await setOrderStatusAction(orderId, next, note);
    setPending(null);
    if (!res.ok) {
      toast.error(t(res.error));
      return false;
    }
    toast.success(t("Statut mis à jour."));
    router.refresh();
    return true;
  }

  return (
    <>
      {primary ? (
        <Button variant="primary" loading={pending === primary} onClick={() => run(primary)}>
          {deliveryMode === "pickup" && primary === "delivered" ? t("Marquer retirée") : t(ORDER_ACTION_LABEL[primary] ?? primary)}
        </Button>
      ) : null}
      {others.length || canCancel ? (
        <Dropdown>
          <DropdownTrigger asChild>
            <Button variant="secondary">
              {t("Statut")} <ChevronDown />
            </Button>
          </DropdownTrigger>
          <DropdownContent>
            <DropdownLabel>{t("Passer à")}</DropdownLabel>
            {others.map((s) => (
              <DropdownItem key={s} onSelect={() => void run(s)}>
                {s === "delivered" && deliveryMode === "pickup" ? t("Retirée par le client") : t(ORDER_ACTION_LABEL[s] ?? s)}
              </DropdownItem>
            ))}
            {canCancel ? (
              <>
                {others.length ? <DropdownSeparator /> : null}
                <DropdownItem destructive onSelect={() => setCancelOpen(true)}>
                  <Ban /> {t("Annuler la commande")}
                </DropdownItem>
              </>
            ) : null}
          </DropdownContent>
        </Dropdown>
      ) : null}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent
          title={t("Annuler la commande")}
          description={t("Le stock des articles suivis est restauré. Une course en attente est annulée.")}
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setCancelOpen(false)}>
                {t("Retour")}
              </Button>
              <Button
                variant="danger"
                loading={pending === "cancelled"}
                onClick={async () => {
                  if (await run("cancelled", reason)) setCancelOpen(false);
                }}
              >
                {t("Annuler la commande")}
              </Button>
            </>
          }
        >
          <Field label={t("Motif")} htmlFor="cancel-reason" optional>
            <Textarea id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("Ex. client injoignable, rupture de stock…")} />
          </Field>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { WhatsAppButton } from "@/components/ui/whatsapp-button";
