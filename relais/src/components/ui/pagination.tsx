import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getI18n } from "@/i18n/server";

export async function Pagination({
  page,
  pageSize,
  total,
  makeHref,
}: {
  page: number;
  pageSize: number;
  total: number;
  makeHref: (page: number) => string;
}) {
  const { t, f } = await getI18n();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-[13px] text-ink-3">
      <span className="tabular">
        {t("{from}–{to} sur {total}", { from: f.number(from), to: f.number(to), total: f.number(total) })}
      </span>
      <div className="flex items-center gap-1">
        <Link
          aria-disabled={page <= 1}
          tabIndex={page <= 1 ? -1 : undefined}
          href={makeHref(Math.max(1, page - 1))}
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }), page <= 1 && "pointer-events-none opacity-40")}
        >
          <ChevronLeft /> {t("Précédent")}
        </Link>
        <Link
          aria-disabled={page >= pages}
          tabIndex={page >= pages ? -1 : undefined}
          href={makeHref(Math.min(pages, page + 1))}
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }), page >= pages && "pointer-events-none opacity-40")}
        >
          {t("Suivant")} <ChevronRight />
        </Link>
      </div>
    </div>
  );
}
