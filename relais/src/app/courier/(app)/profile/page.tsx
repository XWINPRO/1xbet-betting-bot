import Link from "next/link";
import { LayoutGrid, Shield } from "lucide-react";
import { getCourierHome } from "@/lib/data/courier";
import { COURIER_ACCOUNT } from "@/lib/status";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { CourierProfileForm } from "@/components/courier/profile-form";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { env } from "@/lib/env";

export const metadata = { title: "Profil" };

export default async function CourierProfilePage() {
  const home = await getCourierHome();
  const c = home.courier;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Profil</h1>
        <StatusBadge map={COURIER_ACCOUNT} value={c.account_status} />
      </div>
      <section className="rounded-lg border border-line bg-surface p-4">
        <p className="text-[15px] font-semibold">{c.full_name}</p>
        <p className="text-[13px] text-ink-3">{c.kind === "platform" ? `Livreur du réseau ${env.appName}` : "Livreur de boutique"}</p>
        {home.stores.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {home.stores.map((m) =>
              m.stores ? (
                <Badge key={m.stores.id} tone={m.status === "active" ? "neutral" : "danger"} dot={m.status !== "active"}>
                  {m.stores.name}
                  {m.status !== "active" ? " · suspendu" : ""}
                </Badge>
              ) : null,
            )}
          </div>
        ) : null}
      </section>
      <section className="rounded-lg border border-line bg-surface p-4">
        <CourierProfileForm
          canResubmit={c.kind === "platform" && c.account_status === "rejected"}
          initial={{ phone: c.phone, vehicle_type: c.vehicle_type ?? "moto", vehicle_plate: c.vehicle_plate ?? "", zone: c.zone ?? "" }}
        />
      </section>
      <section className="rounded-lg border border-line bg-surface p-4 text-[13px] text-ink-2">
        <p className="font-medium text-ink">Localisation et batterie</p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-ink-3">
          <li>Votre position n&apos;est partagée que pendant une course, ou quand vous êtes « disponible ».</li>
          <li>En course, elle est envoyée toutes les {home.settings.active_interval_s} s ; en attente, toutes les {home.settings.idle_interval_s} s.</li>
          <li>Les navigateurs mobiles peuvent suspendre le GPS quand l&apos;application est en arrière-plan : gardez-la ouverte pendant la livraison.</li>
          <li>Pour un accès rapide, ajoutez l&apos;application à l&apos;écran d&apos;accueil depuis le menu du navigateur.</li>
        </ul>
      </section>
      <div className="flex flex-col gap-2">
        {home.viewer.memberships.length ? (
          <Link href="/dashboard" className="flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-[14px]">
            <LayoutGrid className="size-4 text-ink-3" /> Espace boutique
          </Link>
        ) : null}
        {home.viewer.isAdmin ? (
          <Link href="/admin" className="flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-[14px]">
            <Shield className="size-4 text-ink-3" /> Administration
          </Link>
        ) : null}
        <SignOutButton />
      </div>
    </div>
  );
}
