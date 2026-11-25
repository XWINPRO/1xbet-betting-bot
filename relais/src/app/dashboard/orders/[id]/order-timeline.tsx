"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addOrderNoteAction } from "@/lib/actions/orders";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useI18n } from "@/i18n/client";
import type { I18n } from "@/i18n/translate";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/status";
import type { OrderStatus, PaymentStatus } from "@/types/domain";

export type TimelineEvent = { id: number; type: string; to_status: OrderStatus | null; message: string | null; created_at: string; actor: string | null };

function describe(e: TimelineEvent, t: I18n["t"]) {
  switch (e.type) {
    case "created":
      return t("Commande créée");
    case "status_changed":
      return t("Statut : {status}", { status: e.to_status ? t(ORDER_STATUS[e.to_status].label) : "—" });
    case "payment_changed": {
      const meta = PAYMENT_STATUS[(e.message ?? "unpaid") as PaymentStatus];
      return t("Paiement : {status}", { status: meta ? t(meta.label) : (e.message ?? "—") });
    }
    case "items_updated":
      return t("Articles modifiés");
    case "note":
      return t("Note");
    default:
      return e.type;
  }
}

export function OrderTimeline({ orderId, events }: { orderId: string; events: TimelineEvent[] }) {
  const { t, f } = useI18n();
  const router = useRouter();
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);
  return (
    <Panel>
      <PanelHeader title={t("Historique")} />
      <ol className="px-5 pt-4">
        {events.map((e, i) => (
          <li key={e.id} className="relative flex gap-3 pb-4">
            {i < events.length - 1 ? <span className="absolute top-3 left-[3px] h-full w-px bg-line" aria-hidden /> : null}
            <span className={`relative mt-1.5 size-[7px] shrink-0 rounded-full ${e.type === "note" ? "bg-warning" : "bg-ink-4"}`} />
            <div className="min-w-0 text-[13px]">
              <p className="text-ink">{describe(e, t)}</p>
              {e.message && e.type !== "payment_changed" ? <p className="mt-0.5 whitespace-pre-line text-ink-2">{e.message}</p> : null}
              <p className="text-xs text-ink-3">
                {f.dateTime(e.created_at)}
                {e.actor ? ` · ${e.actor}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <form
        className="flex flex-col gap-2 border-t border-line px-5 py-3"
        onSubmit={async (ev) => {
          ev.preventDefault();
          if (!note.trim()) return;
          setPending(true);
          const res = await addOrderNoteAction(orderId, note);
          setPending(false);
          if (!res.ok) return toast.error(t(res.error));
          setNote("");
          router.refresh();
        }}
      >
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={t("Ajouter une note interne (échange WhatsApp, demande particulière…)")} aria-label={t("Note interne")} />
        <Button type="submit" size="sm" className="self-end" loading={pending} disabled={!note.trim()}>
          {t("Ajouter la note")}
        </Button>
      </form>
    </Panel>
  );
}
