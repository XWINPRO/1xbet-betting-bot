"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, X } from "lucide-react";
import { createStaffInviteAction, removeMemberAction, revokeInvitationAction, updateMemberPermissionsAction } from "@/lib/actions/team";
import { STAFF_PERMISSIONS, PERMISSION_LABEL } from "@/lib/permissions";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/switch";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/components/ui/client-helpers";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { Notice } from "@/components/ui/page";
import { formatDate } from "@/lib/format";
import { whatsappShareUrl, waMessages } from "@/lib/whatsapp";

type Member = { user_id: string; role: "owner" | "staff"; permissions: string[]; name: string; email: string | null; isMe: boolean };
type Invite = { id: string; label: string | null; permissions: string[]; expires_at: string; created_at: string };

function PermissionChecklist({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-col gap-2.5">
      {STAFF_PERMISSIONS.map((p) => (
        <label key={p.key} className="flex items-start gap-2.5 text-[13.5px]">
          <Checkbox className="mt-0.5" checked={value.includes(p.key)} onCheckedChange={(c) => onChange(c ? [...value, p.key] : value.filter((x) => x !== p.key))} />
          <span>
            <span className="font-medium text-ink">{p.label}</span>
            <span className="block text-xs text-ink-3">{p.hint}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export function TeamSettings({ members, invites, storeName }: { members: Member[]; invites: Invite[]; storeName: string }) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [perms, setPerms] = React.useState<string[]>(["orders.create", "orders.edit", "products.view"]);
  const [label, setLabel] = React.useState("");
  const [link, setLink] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<Member | null>(null);
  const [editPerms, setEditPerms] = React.useState<string[]>([]);
  const [pending, setPending] = React.useState(false);

  return (
    <Panel>
      <PanelHeader
        title="Équipe"
        description="Les employés n'accèdent jamais aux paramètres, à la boutique en ligne ni à la gestion des livreurs."
        actions={
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setLink(null);
              setLabel("");
              setInviteOpen(true);
            }}
          >
            <UserPlus /> Inviter un employé
          </Button>
        }
      />
      <ul className="divide-y divide-line">
        {members.map((m) => (
          <li key={m.user_id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <Avatar name={m.name} size={32} />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium text-ink">
                {m.name || m.email} {m.isMe ? <span className="font-normal text-ink-3">(vous)</span> : null}
              </p>
              <p className="text-xs text-ink-3">
                {m.role === "owner" ? "Propriétaire · tous les droits" : m.permissions.length ? m.permissions.map((p) => PERMISSION_LABEL[p] ?? p).join(" · ") : "Lecture des commandes uniquement"}
              </p>
            </div>
            {m.role === "owner" ? (
              <Badge tone="neutral" dot={false}>Propriétaire</Badge>
            ) : (
              <div className="flex gap-1">
                <Button size="sm" variant="secondary" onClick={() => (setEditing(m), setEditPerms(m.permissions))}>
                  Permissions
                </Button>
                <Button
                  size="sm"
                  variant="danger-ghost"
                  onClick={async () => {
                    const res = await removeMemberAction(m.user_id);
                    if (!res.ok) return toast.error(res.error);
                    toast.success(res.message ?? "Retiré.");
                    router.refresh();
                  }}
                >
                  Retirer
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {invites.length ? (
        <div className="border-t border-line px-5 py-3">
          <p className="mb-2 text-xs font-medium text-ink-3">Invitations en attente</p>
          <ul className="flex flex-col gap-2">
            {invites.map((i) => (
              <li key={i.id} className="flex items-center gap-3 text-[13px]">
                <span className="flex-1 truncate text-ink-2">
                  {i.label || "Invitation"} · expire le {formatDate(i.expires_at)}
                </span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Révoquer"
                  onClick={async () => {
                    const res = await revokeInvitationAction(i.id);
                    if (!res.ok) return toast.error(res.error);
                    router.refresh();
                  }}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent
          size="md"
          title="Inviter un employé"
          description="Un lien d'invitation unique, valable 7 jours, à transmettre à la personne."
          footer={
            link ? (
              <Button variant="primary" onClick={() => setInviteOpen(false)}>
                Terminé
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setInviteOpen(false)}>
                  Annuler
                </Button>
                <Button
                  variant="primary"
                  loading={pending}
                  onClick={async () => {
                    setPending(true);
                    const res = await createStaffInviteAction(perms, label);
                    setPending(false);
                    if (!res.ok) return toast.error(res.error);
                    setLink(res.data.url);
                    router.refresh();
                  }}
                >
                  Générer le lien
                </Button>
              </>
            )
          }
        >
          {link ? (
            <div className="flex flex-col gap-3">
              <Notice tone="success">Invitation créée. La personne crée un compte ou se connecte, puis rejoint la boutique.</Notice>
              <p className="truncate rounded-md border border-line bg-subtle p-2.5 font-mono text-xs text-ink-2">{link}</p>
              <div className="flex gap-2">
                <CopyButton value={link} label="Copier le lien" />
                <WhatsAppButton size="sm" label="Envoyer par WhatsApp" href={whatsappShareUrl(waMessages.staffInvite({ storeName, url: link }))} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <Field label="Repère" htmlFor="inv-label" optional hint="Pour vous souvenir à qui l'invitation est destinée.">
                <Input id="inv-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Aïcha — caisse" />
              </Field>
              <PermissionChecklist value={perms} onChange={setPerms} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent
          size="md"
          title={`Permissions — ${editing?.name || editing?.email || ""}`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Annuler
              </Button>
              <Button
                variant="primary"
                loading={pending}
                onClick={async () => {
                  if (!editing) return;
                  setPending(true);
                  const res = await updateMemberPermissionsAction(editing.user_id, editPerms);
                  setPending(false);
                  if (!res.ok) return toast.error(res.error);
                  toast.success("Permissions mises à jour.");
                  setEditing(null);
                  router.refresh();
                }}
              >
                Enregistrer
              </Button>
            </>
          }
        >
          <PermissionChecklist value={editPerms} onChange={setEditPerms} />
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
