"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { confirmTransactionAction, recordPaymentAction } from "@/lib/actions/orders";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, InputGroup, NativeSelect } from "@/components/ui/input";
import { formatDateTime, formatMoney } from "@/lib/format";
import { PAYMENT_METHOD, PAYMENT_STATUS, TRANSACTION_STATUS } from "@/lib/status";
import type { PaymentMethod, PaymentStatus, TransactionStatus } from "@/types/domain";

type Tx = { id: string; amount: number; method: PaymentMethod; status: TransactionStatus; notes: string | null; provider_reference: string | null; created_at: string };

export function PaymentPanel({
  orderId,
  total,
  currency,
  paymentStatus,
  paymentMethod,
  transactions,
  canEdit,
}: {
  orderId: string;
  total: number;
  currency: string;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  transactions: Tx[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const confirmed = transactions.filter((t) => t.status === "confirmed").reduce((s, t) => s + t.amount, 0);
  const remaining = Math.max(0, total - confirmed);
  const [form, setForm] = React.useState({ amount: String(remaining || total), method: paymentMethod === "cash_on_delivery" ? "cash_on_delivery" : paymentMethod, provider_reference: "", notes: "" });
  const [error, setError] = React.useState<string | null>(null);

  async function act(txId: string, status: TransactionStatus) {
    setBusy(txId);
    const res = await confirmTransactionAction(txId, status, `/dashboard/orders/${orderId}`);
    setBusy(null);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success(res.message ?? "Mis à jour.");
      router.refresh();
    }
  }

  return (
    <Panel>
      <PanelHeader
        title="Paiement"
        description={`${PAYMENT_METHOD[paymentMethod]} · encaissé ${formatMoney(confirmed, currency)} sur ${formatMoney(total, currency)}`}
        actions={<StatusBadge map={PAYMENT_STATUS} value={paymentStatus} />}
      />
      {transactions.length ? (
        <ul className="divide-y divide-line">
          {transactions.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-[13px]">
              <div className="min-w-0 flex-1">
                <p className="font-medium tabular text-ink">{formatMoney(t.amount, currency)}</p>
                <p className="text-xs text-ink-3">
                  {PAYMENT_METHOD[t.method]} · {formatDateTime(t.created_at)}
                  {t.provider_reference ? ` · réf. ${t.provider_reference}` : ""}
                </p>
                {t.notes ? <p className="text-xs text-ink-3">{t.notes}</p> : null}
              </div>
              <StatusBadge map={TRANSACTION_STATUS} value={t.status} />
              {canEdit && t.status === "pending" ? (
                <div className="flex gap-1">
                  <Button size="xs" variant="success" loading={busy === t.id} onClick={() => act(t.id, "confirmed")}>
                    Confirmer la réception
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => act(t.id, "failed")}>
                    Rejeter
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-4 text-[13px] text-ink-3">
          Aucun paiement enregistré.{" "}
          {paymentMethod === "cash_on_delivery" ? "Le livreur pourra déclarer l'encaissement à la livraison." : "Enregistrez le paiement dès réception."}
        </p>
      )}
      {canEdit && remaining > 0 && paymentStatus !== "refunded" ? (
        <div className="border-t border-line px-5 py-3">
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus /> Enregistrer un paiement
          </Button>
        </div>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="Enregistrer un paiement"
          description="Enregistrement manuel d'un paiement réellement reçu. Aucun prélèvement n'est effectué."
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button
                variant="primary"
                loading={busy === "new"}
                onClick={async () => {
                  setBusy("new");
                  setError(null);
                  const res = await recordPaymentAction(orderId, form);
                  setBusy(null);
                  if (!res.ok) {
                    setError(res.error);
                    return;
                  }
                  toast.success("Paiement enregistré.");
                  setOpen(false);
                  router.refresh();
                }}
              >
                Enregistrer
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            {error ? <p className="text-[13px] text-danger-ink">{error}</p> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Montant reçu" htmlFor="pay-amount">
                <InputGroup id="pay-amount" type="number" min={1} suffix="FCFA" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
              </Field>
              <Field label="Moyen" htmlFor="pay-method">
                <NativeSelect id="pay-method" value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value as PaymentMethod }))}>
                  {(Object.keys(PAYMENT_METHOD) as PaymentMethod[]).map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD[m]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field label="Référence de transaction" htmlFor="pay-ref" optional hint="Ex. identifiant du transfert Mobile Money.">
              <Input id="pay-ref" value={form.provider_reference} onChange={(e) => setForm((f) => ({ ...f, provider_reference: e.target.value }))} />
            </Field>
            <Field label="Note" htmlFor="pay-notes" optional>
              <Input id="pay-notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </Field>
          </div>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
