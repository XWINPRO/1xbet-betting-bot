import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CLAIM_CATEGORY, CLAIM_STATUS } from "@/lib/status";
import { formatDateTime } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { sanitizeSearch } from "@/lib/search";
import { param } from "@/lib/utils";
import { EmptyState, PageContainer, PageHeader } from "@/components/ui/page";
import { Panel } from "@/components/ui/panel";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { SearchInput } from "@/components/ui/client-helpers";
import { StatusBadge, Tag } from "@/components/ui/badge";
import { ClaimEditor } from "@/components/admin/claim-editor";
import type { ClaimStatus } from "@/types/domain";

export const metadata = { title: "Réclamations" };

const REPORTER: Record<string, string> = { customer: "Client", courier: "Livreur", store: "Boutique", admin: "Administration" };

export default async function AdminClaimsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const tab = param(sp.tab) ?? "open";
  const q = sanitizeSearch(param(sp.q));
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("claims")
    .select("*, stores(name), delivery_jobs(id, reference)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (tab === "open") query = query.in("status", ["open", "investigating"]);
  else if (tab !== "all") query = query.eq("status", tab as ClaimStatus);
  if (q) query = query.or(`reference.ilike.%${q}%,reporter_name.ilike.%${q}%,description.ilike.%${q}%`);
  const { data: claims } = await query;

  return (
    <PageContainer>
      <PageHeader title="Réclamations et incidents" description="Signalements des clients (page de suivi), des livreurs et des boutiques." />
      <Panel>
        <div className="flex flex-col gap-3 border-b border-line px-5 pt-2 lg:flex-row lg:items-end lg:justify-between">
          <FilterTabs
            active={tab}
            items={[
              { key: "open", label: "À traiter", href: "/admin/claims?tab=open" },
              { key: "resolved", label: "Résolues", href: "/admin/claims?tab=resolved" },
              { key: "rejected", label: "Rejetées", href: "/admin/claims?tab=rejected" },
              { key: "all", label: "Toutes", href: "/admin/claims?tab=all" },
            ]}
          />
          <div className="pb-2.5">
            <SearchInput placeholder="Référence, nom, texte" />
          </div>
        </div>
        {!claims?.length ? (
          <EmptyState title="Aucune réclamation" />
        ) : (
          <ul className="divide-y divide-line">
            {claims.map((c) => (
              <li key={c.id} className="flex flex-wrap items-start gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-ink-3">{c.reference}</span>
                    <span className="text-[14px] font-medium">{CLAIM_CATEGORY[c.category] ?? c.category}</span>
                    <StatusBadge map={CLAIM_STATUS} value={c.status} />
                    <Tag>{REPORTER[c.reporter_type]}</Tag>
                  </div>
                  <p className="mt-1 text-[13.5px] whitespace-pre-line text-ink-2">{c.description}</p>
                  <p className="mt-1 text-xs text-ink-3">
                    {c.reporter_name ?? "—"}
                    {c.reporter_phone ? ` · ${formatPhone(c.reporter_phone)}` : ""} · {formatDateTime(c.created_at)}
                    {c.stores?.name ? ` · ${c.stores.name}` : ""}
                    {c.delivery_jobs ? (
                      <>
                        {" · "}
                        <Link href={`/admin/deliveries/${c.delivery_jobs.id}`} className="text-accent hover:underline">
                          {c.delivery_jobs.reference}
                        </Link>
                      </>
                    ) : null}
                  </p>
                  {c.resolution ? <p className="mt-2 rounded-md bg-subtle px-3 py-2 text-[13px] text-ink-2">Résolution : {c.resolution}</p> : null}
                </div>
                <ClaimEditor id={c.id} status={c.status} resolution={c.resolution} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </PageContainer>
  );
}
