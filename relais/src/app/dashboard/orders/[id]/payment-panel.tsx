"use client";

import { useI18n } from "@/i18n/client";
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
  const { t, f } = useI18n();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const confirmed = transactions.filter((tx) => tx.status === "confirmed").reduce((s, tx) => s + tx.amount, 0);
  const remaining = Math.max(0, total - confirmed);
  const [form, setForm] = React.useState({ amount: String(remaining || total), method: paymentMethod === "cash_on_delivery" ? "cash_on_delivery" : paymentMethod, provider_reference: "", notes: "" });
  const [error, setError] = React.useState<string | null>(null);

  async function act(txId: string, status: TransactionStatus) {
    setBusy(txId);
    const res = await confirmTransactionAction(txId, status, `/dashboard/orders/${orderId}`);
    setBusy(null);
    if (!res.ok) toast.error(t(res.error));
    else {
      toast.success(t(res.message ?? "Mis à jour."));
      router.refresh();
    }
  }

  return (
    <Panel>
      <PanelHeader
        title={t("Paiement")}
        description={`${t(PAYMENT_METHOD[paymentMethod])} · ${t("encaissé {paid} sur {total}", { paid: f.money(confirmed, currency), total: f.money(total, currency) })}`}
        actions={<StatusBadge map={PAYMENT_STATUS} value={paymentStatus} />}
      />
      {transactions.length ? (
        <ul className="divide-y divide-line">
          {transactions.map((tx) => (
            <li key={tx.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-[13px]">
              <div className="min-w-0 flex-1">
                <p className="font-medium tabular text-ink">{f.money(tx.amount, currency)}</p>
                <p className="text-xs text-ink-3">
                  {t(PAYMENT_METHOD[tx.method])} · {f.dateTime(tx.created_at)}
                  {tx.provider_reference ? ` · ${t("réf. {ref}", { ref: tx.provider_reference })}` : ""}
                </p>
                {tx.notes ? <p className="text-xs text-ink-3">{t(tx.notes)}</p> : null}
              </div>
              <StatusBadge map={TRANSACTION_STATUS} value={tx.status} />
              {canEdit && tx.status === "pending" ? (
                <div className="flex gap-1">
                  <Button size="xs" variant="success" loading={busy === tx.id} onClick={() => act(tx.id, "confirmed")}>
                    {t("Confirmer la réception")}
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => act(tx.id, "failed")}>
                    {t("Rejeter")}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-4 text-[13px] text-ink-3">
          {t("Aucun paiement enregistré.")}{" "}
          {paymentMethod === "cash_on_delivery" ? t("Le livreur pourra déclarer l'encaissement à la livraison.") : t("Enregistrez le paiement dès réception.")}
        </p>
      )}
      {canEdit && remaining > 0 && paymentStatus !== "refunded" ? (
        <div className="border-t border-line px-5 py-3">
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus /> {t("Enregistrer un paiement")}
          </Button>
        </div>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title={t("Enregistrer un paiement")}
          description={t("Enregistrement manuel d'un paiement réellement reçu. Aucun prélèvement n'est effectué.")}
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                {t("Annuler")}
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
                  toast.success(t("Paiement enregistré."));
                  setOpen(false);
                  router.refresh();
                }}
              >
                {t("Enregistrer")}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            {error ? <p className="text-[13px] text-danger-ink">{t(error)}</p> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("Montant reçu")} htmlFor="pay-amount">
                <InputGroup id="pay-amount" type="number" min={1} suffix="FCFA" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
              </Field>
              <Field label={t("Moyen")} htmlFor="pay-method">
                <NativeSelect id="pay-method" value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value as PaymentMethod }))}>
                  {(Object.keys(PAYMENT_METHOD) as PaymentMethod[]).map((m) => (
                    <option key={m} value={m}>
                      {t(PAYMENT_METHOD[m])}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field label={t("Référence de transaction")} htmlFor="pay-ref" optional hint={t("Ex. identifiant du transfert Mobile Money.")}>
              <Input id="pay-ref" value={form.provider_reference} onChange={(e) => setForm((f) => ({ ...f, provider_reference: e.target.value }))} />
            </Field>
            <Field label={t("Note")} htmlFor="pay-notes" optional>
              <Input id="pay-notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </Field>
          </div>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
