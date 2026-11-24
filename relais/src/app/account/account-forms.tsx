"use client";

import * as React from "react";
import { toast } from "sonner";
import { changePasswordAction, updateProfileAction } from "@/lib/actions/account";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader, PanelFooter } from "@/components/ui/panel";

export function AccountForms({ initial, email }: { initial: { full_name: string; phone: string }; email: string | null }) {
  const [v, setV] = React.useState(initial);
  const [pwd, setPwd] = React.useState("");
  const [pending, setPending] = React.useState<string | null>(null);
  return (
    <div className="flex flex-col gap-6">
      <Panel>
        <PanelHeader title="Profil" description={email ?? undefined} />
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          <Field label="Nom complet" htmlFor="acc-name">
            <Input id="acc-name" value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} />
          </Field>
          <Field label="Téléphone" htmlFor="acc-phone">
            <Input id="acc-phone" type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
          </Field>
        </div>
        <PanelFooter>
          <Button
            variant="primary"
            loading={pending === "profile"}
            onClick={async () => {
              setPending("profile");
              const res = await updateProfileAction(v);
              setPending(null);
              if (!res.ok) toast.error(res.error);
              else toast.success(res.message ?? "Enregistré.");
            }}
          >
            Enregistrer
          </Button>
        </PanelFooter>
      </Panel>
      <Panel>
        <PanelHeader title="Mot de passe" />
        <div className="px-5 py-4">
          <Field label="Nouveau mot de passe" htmlFor="acc-pwd" hint="8 caractères minimum." className="sm:max-w-sm">
            <Input id="acc-pwd" type="password" autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
          </Field>
        </div>
        <PanelFooter>
          <Button
            loading={pending === "pwd"}
            disabled={pwd.length < 8}
            onClick={async () => {
              setPending("pwd");
              const res = await changePasswordAction(pwd);
              setPending(null);
              if (!res.ok) toast.error(res.error);
              else {
                toast.success(res.message ?? "Modifié.");
                setPwd("");
              }
            }}
          >
            Modifier le mot de passe
          </Button>
        </PanelFooter>
      </Panel>
    </div>
  );
}
