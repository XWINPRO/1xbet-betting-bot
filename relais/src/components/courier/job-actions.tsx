"use client";

import { useI18n } from "@/i18n/client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Camera, CheckCircle2, PackageCheck, Send, XCircle } from "lucide-react";
import { reportIssueAction, respondOfferAction, updateJobStatusAction } from "@/lib/actions/courier";
import { useCourierLocation } from "@/components/courier/location-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { downscale } from "@/components/ui/image-uploader";
import { randomFileName } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/switch";
import { CLAIM_CATEGORY } from "@/lib/status";
import type { JobStatus } from "@/types/domain";

export function JobActions({
  jobId,
  status,
  collectAmount,
  currency,
  recipientName,
}: {
  jobId: string;
  status: JobStatus;
  collectAmount: number;
  currency: string;
  recipientName: string;
}) {
  const { t, f } = useI18n();
  const router = useRouter();
  const { lastFix } = useCourierLocation();
  const [pending, setPending] = React.useState<string | null>(null);
  const [deliverOpen, setDeliverOpen] = React.useState(false);
  const [failOpen, setFailOpen] = React.useState(false);
  const [issueOpen, setIssueOpen] = React.useState(false);
  const [photo, setPhoto] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [recipient, setRecipient] = React.useState(recipientName);
  const [note, setNote] = React.useState("");
  const [cash, setCash] = React.useState(collectAmount > 0);
  const [reason, setReason] = React.useState("");
  const [issue, setIssue] = React.useState({ category: "address", description: "" });

  const where = lastFix ? { lat: lastFix.lat, lng: lastFix.lng } : {};

  async function step(next: "picked_up" | "in_transit") {
    setPending(next);
    const res = await updateJobStatusAction(jobId, next, where);
    setPending(null);
    if (!res.ok) return toast.error(t(res.error));
    toast.success(next === "picked_up" ? t("Colis récupéré.") : t("En route vers le destinataire."));
    router.refresh();
  }

  async function deliver() {
    setPending("delivered");
    let proofPath: string | null = null;
    if (photo) {
      try {
        const prepared = await downscale(photo, 1400);
        const path = `${jobId}/${randomFileName(prepared)}`;
        const { error } = await getSupabaseBrowserClient().storage.from("delivery-proofs").upload(path, prepared, { contentType: prepared.type, upsert: false });
        if (error) throw error;
        proofPath = path;
      } catch {
        setPending(null);
        toast.error(t("Envoi de la photo impossible. Réessayez ou validez sans photo."));
        return;
      }
    }
    const res = await updateJobStatusAction(jobId, "delivered", { ...where, proof_photo_path: proofPath, recipient_name: recipient, note, cash_collected: collectAmount > 0 ? cash : false });
    setPending(null);
    if (!res.ok) return toast.error(t(res.error));
    toast.success(t("Livraison confirmée. Merci !"));
    setDeliverOpen(false);
    router.refresh();
  }

  async function failJob() {
    if (reason.trim().length < 3) return toast.error(t("Indiquez le motif de l'échec."));
    setPending("failed");
    const res = await updateJobStatusAction(jobId, "failed", { ...where, reason });
    setPending(null);
    if (!res.ok) return toast.error(t(res.error));
    toast.success(t("Échec enregistré. La boutique est informée."));
    setFailOpen(false);
    router.refresh();
  }

  if (status === "offered") {
    return (
      <div className="grid grid-cols-[1fr_2fr] gap-2">
        <Button
          size="xl"
          variant="secondary"
          loading={pending === "decline"}
          onClick={async () => {
            setPending("decline");
            const res = await respondOfferAction(jobId, false);
            setPending(null);
            if (!res.ok) return toast.error(t(res.error));
            router.push("/courier");
          }}
        >
          {t("Refuser")}
        </Button>
        <Button
          size="xl"
          variant="primary"
          loading={pending === "accept"}
          onClick={async () => {
            setPending("accept");
            const res = await respondOfferAction(jobId, true);
            setPending(null);
            if (!res.ok) return toast.error(t(res.error));
            router.refresh();
          }}
        >
          {t("Accepter la course")}
        </Button>
      </div>
    );
  }

  if (!["accepted", "picked_up", "in_transit"].includes(status)) return null;

  return (
    <div className="flex flex-col gap-2">
      {status === "accepted" ? (
        <Button size="xl" variant="primary" block loading={pending === "picked_up"} onClick={() => step("picked_up")}>
          <PackageCheck /> {t("J'ai récupéré le colis")}
        </Button>
      ) : null}
      {status === "picked_up" ? (
        <Button size="xl" variant="primary" block loading={pending === "in_transit"} onClick={() => step("in_transit")}>
          <Send /> {t("Je pars livrer")}
        </Button>
      ) : null}
      {status === "picked_up" || status === "in_transit" ? (
        <Button size="xl" variant={status === "in_transit" ? "success" : "secondary"} block onClick={() => setDeliverOpen(true)}>
          <CheckCircle2 /> {t("Confirmer la livraison")}
        </Button>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button size="lg" variant="secondary" onClick={() => setIssueOpen(true)}>
          <AlertTriangle /> {t("Signaler")}
        </Button>
        <Button size="lg" variant="danger-ghost" onClick={() => setFailOpen(true)}>
          <XCircle /> {t("Échec")}
        </Button>
      </div>

      <Dialog open={deliverOpen} onOpenChange={setDeliverOpen}>
        <DialogContent
          title={t("Confirmer la livraison")}
          footer={
            <Button size="lg" variant="success" block loading={pending === "delivered"} onClick={deliver}>
              {t("Valider la livraison")}
            </Button>
          }
        >
          <div className="flex flex-col gap-4">
            {collectAmount > 0 ? (
              <label className="flex items-start gap-3 rounded-md border border-warning/30 bg-warning-soft px-3 py-3 text-[14px] text-warning-ink">
                <Checkbox className="mt-0.5" checked={cash} onCheckedChange={(c) => setCash(c === true)} />
                <span>
                  {t("J'ai encaissé")} <span className="font-semibold tabular">{f.money(collectAmount, currency)}</span>
                  <span className="block text-xs opacity-90">{t("Le montant sera à remettre à la boutique, qui confirmera la réception.")}</span>
                </span>
              </label>
            ) : null}
            <Field label={t("Photo de preuve")} optional hint={t("Colis remis, signature ou lieu de dépôt.")}>
              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-line-strong px-3 py-3 text-[13.5px] text-ink-2 hover:bg-subtle">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt={t("Aperçu")} className="size-14 rounded-sm object-cover" />
                ) : (
                  <Camera className="size-5 text-ink-3" />
                )}
                {photo ? t("Changer la photo") : t("Prendre une photo")}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setPhoto(file);
                    setPreview(file ? URL.createObjectURL(file) : null);
                  }}
                />
              </label>
            </Field>
            <Field label={t("Remis à")} htmlFor="recipient" optional>
              <Input id="recipient" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
            </Field>
            <Field label={t("Note")} htmlFor="note" optional>
              <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Ex. remis au gardien")} />
            </Field>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={failOpen} onOpenChange={setFailOpen}>
        <DialogContent
          title={t("Livraison impossible")}
          description={t("La course sera clôturée en échec et la boutique prévenue.")}
          footer={
            <Button size="lg" variant="danger" block loading={pending === "failed"} onClick={failJob}>
              {t("Enregistrer l'échec")}
            </Button>
          }
        >
          <Field label={t("Motif")} htmlFor="fail-reason">
            <Textarea id="fail-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("Destinataire absent, adresse introuvable, colis refusé…")} />
          </Field>
        </DialogContent>
      </Dialog>

      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent
          title={t("Signaler un problème")}
          description={t("Le signalement est transmis à la boutique et à l'administration. La course continue.")}
          footer={
            <Button
              size="lg"
              variant="primary"
              block
              loading={pending === "issue"}
              onClick={async () => {
                setPending("issue");
                const res = await reportIssueAction(jobId, issue.category, issue.description);
                setPending(null);
                if (!res.ok) return toast.error(t(res.error));
                toast.success(t("Signalement {ref} envoyé.", { ref: res.data.reference }));
                setIssueOpen(false);
                setIssue({ category: "address", description: "" });
              }}
            >
              {t("Envoyer")}
            </Button>
          }
        >
          <div className="flex flex-col gap-4">
            <Field label={t("Type de problème")} htmlFor="issue-cat">
              <NativeSelect id="issue-cat" value={issue.category} onChange={(e) => setIssue({ ...issue, category: e.target.value })}>
                {Object.entries(CLAIM_CATEGORY).map(([k, label]) => (
                  <option key={k} value={k}>
                    {t(label)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t("Description")} htmlFor="issue-desc">
              <Textarea id="issue-desc" rows={3} value={issue.description} onChange={(e) => setIssue({ ...issue, description: e.target.value })} />
            </Field>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
