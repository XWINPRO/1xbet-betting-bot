import Link from "next/link";
import { History } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCourier } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import type { Metadata } from "next";
import { JOB_STATUS } from "@/lib/status";
import { pageNumber } from "@/lib/search";
import { param } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/page";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Historique") };
}
const PAGE = 20;

export default async function CourierHistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { courier } = await requireCourier();
  const { t, f } = await getI18n();
  const supabase = await createSupabaseServerClient();
  const page = pageNumber(param(sp.page));
  const { data: jobs, count } = await supabase
    .from("delivery_jobs")
    .select("id, reference, status, dropoff_address, collect_amount, cash_collected, currency, delivered_at, failed_at, cancelled_at, created_at, stores(name)", { count: "exact" })
    .eq("courier_id", courier.id)
    .in("status", ["delivered", "failed", "cancelled"])
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  const total = count ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-lg font-semibold">{t("Historique des courses")}</h1>
      {!jobs?.length ? (
        <div className="rounded-lg border border-line bg-surface">
          <EmptyState compact icon={<History />} title={t("Aucune course terminée")} description={t("Vos livraisons terminées, échouées ou annulées apparaîtront ici.")} />
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {jobs.map((j) => (
            <li key={j.id}>
              <Link href={`/courier/jobs/${j.id}`} className="flex items-start gap-3 px-4 py-3 active:bg-subtle">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-medium">{j.stores?.name ?? "—"}</span>
                    <span className="font-mono text-[11px] text-ink-3">{j.reference}</span>
                  </div>
                  <p className="truncate text-[13px] text-ink-2">{j.dropoff_address}</p>
                  <p className="text-xs text-ink-3">{f.dateTime(j.delivered_at ?? j.failed_at ?? j.cancelled_at ?? j.created_at)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge map={JOB_STATUS} value={j.status} />
                  {j.cash_collected ? <span className="text-[11px] text-ink-3">{t("encaissé {amount}", { amount: f.money(j.collect_amount, j.currency) })}</span> : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {total > PAGE ? (
        <div className="flex justify-between text-[13px]">
          {page > 1 ? <Link href={`/courier/history?page=${page - 1}`} className="text-accent">{t("← Plus récentes")}</Link> : <span />}
          {page * PAGE < total ? <Link href={`/courier/history?page=${page + 1}`} className="text-accent">{t("Plus anciennes →")}</Link> : null}
        </div>
      ) : null}
    </div>
  );
}
