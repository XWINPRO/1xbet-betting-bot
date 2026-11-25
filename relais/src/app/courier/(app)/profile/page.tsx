import Link from "next/link";
import { LayoutGrid, Shield } from "lucide-react";
import { getCourierHome } from "@/lib/data/courier";
import { COURIER_ACCOUNT } from "@/lib/status";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { CourierProfileForm } from "@/components/courier/profile-form";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { getI18n } from "@/i18n/server";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Profil") };
}

export default async function CourierProfilePage() {
  const home = await getCourierHome();
  const c = home.courier;
  const { t } = await getI18n();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{t("Profil")}</h1>
        <StatusBadge map={COURIER_ACCOUNT} value={c.account_status} />
      </div>
      <section className="rounded-lg border border-line bg-surface p-4">
        <p className="text-[15px] font-semibold">{c.full_name}</p>
        <p className="text-[13px] text-ink-3">{t("Livreur parrainé par votre commerçant")}</p>
        {home.stores.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {home.stores.map((m) =>
              m.stores ? (
                <Badge key={m.stores.id} tone={m.status === "active" ? "neutral" : "danger"} dot={m.status !== "active"}>
                  {m.stores.name}
                  {m.status !== "active" ? ` · ${t("accès suspendu")}` : ""}
                </Badge>
              ) : null,
            )}
          </div>
        ) : null}
      </section>
      <section className="rounded-lg border border-line bg-surface p-4">
        <CourierProfileForm
          initial={{ phone: c.phone, vehicle_type: c.vehicle_type ?? "moto", vehicle_plate: c.vehicle_plate ?? "", zone: c.zone ?? "" }}
        />
      </section>
      <section className="rounded-lg border border-line bg-surface p-4 text-[13px] text-ink-2">
        <p className="font-medium text-ink">{t("Localisation et batterie")}</p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-ink-3">
          <li>{t("Votre position n'est partagée que pendant une course, ou quand vous êtes « disponible ».")}</li>
          <li>{t("En course, elle est envoyée toutes les {a} s ; en attente, toutes les {b} s.", { a: home.settings.active_interval_s, b: home.settings.idle_interval_s })}</li>
          <li>{t("Les navigateurs mobiles peuvent suspendre le GPS quand l'application est en arrière-plan : gardez-la ouverte pendant la livraison.")}</li>
          <li>{t("Pour un accès rapide, ajoutez l'application à l'écran d'accueil depuis le menu du navigateur.")}</li>
        </ul>
      </section>
      <div className="flex flex-col gap-2">
        {home.viewer.memberships.length ? (
          <Link href="/dashboard" className="flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-[14px]">
            <LayoutGrid className="size-4 text-ink-3" /> {t("Espace boutique")}
          </Link>
        ) : null}
        {home.viewer.isAdmin ? (
          <Link href="/admin" className="flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-[14px]">
            <Shield className="size-4 text-ink-3" /> {t("Administration")}
          </Link>
        ) : null}
        <SignOutButton />
      </div>
    </div>
  );
}
