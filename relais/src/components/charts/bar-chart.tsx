"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type BarSeries = { key: string; label: string; color: string };
export type BarDatum = { key: string; label: string; fullLabel?: string; values: Record<string, number> };

function niceMax(v: number) {
  if (v <= 0) return 4;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nf * exp;
}

function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  if (n >= 10_000) return `${Math.round(n / 1000).toLocaleString("fr-FR")} k`;
  return n.toLocaleString("fr-FR");
}

/** Chemin d'une barre avec extrémité de données arrondie (4px), base carrée. */
function barPath(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

/**
 * Histogramme en colonnes (série simple ou empilée). Marques fines, base
 * unique, grille discrète, info-bulle au survol, vue tableau accessible.
 */
export function BarChart({
  data,
  series,
  height = 220,
  formatValue = (n) => n.toLocaleString("fr-FR"),
  title,
  className,
}: {
  data: BarDatum[];
  series: BarSeries[];
  height?: number;
  formatValue?: (n: number) => string;
  title: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);
  const [hover, setHover] = React.useState<number | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const totals = data.map((d) => series.reduce((s, se) => s + (d.values[se.key] ?? 0), 0));
  const max = niceMax(Math.max(0, ...totals));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const padLeft = 44;
  const padBottom = 22;
  const padTop = 8;
  const plotW = Math.max(0, width - padLeft - 4);
  const plotH = height - padBottom - padTop;
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.max(2, Math.min(24, band * 0.62));
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(plotW / 56))));
  const y = (v: number) => padTop + plotH - (v / max) * plotH;

  return (
    <div className={cn("relative", className)}>
      {series.length > 1 ? (
        <ul className="mb-3 flex flex-wrap gap-4 text-xs text-ink-2" aria-label="Légende">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} aria-hidden />
              {s.label}
            </li>
          ))}
        </ul>
      ) : null}
      <div ref={ref} className="relative w-full" style={{ height }}>
        {width > 0 ? (
          <svg width={width} height={height} role="img" aria-label={title} className="block overflow-visible">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padLeft} x2={width} y1={y(t)} y2={y(t)} stroke="#E3E7ED" strokeWidth={1} shapeRendering="crispEdges" />
                <text x={padLeft - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-ink-3 text-[11px] tabular">
                  {compact(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const cx = padLeft + band * i + band / 2;
              let acc = 0;
              const segments = series
                .map((s) => ({ s, v: d.values[s.key] ?? 0 }))
                .filter((x) => x.v > 0);
              return (
                <g key={d.key}>
                  {segments.map(({ s, v }, si) => {
                    const top = y(acc + v);
                    const bottom = y(acc);
                    acc += v;
                    const isTop = si === segments.length - 1;
                    const gap = si > 0 ? 2 : 0;
                    const h = Math.max(0, bottom - top - gap);
                    return isTop ? (
                      <path key={s.key} d={barPath(cx - barW / 2, top, barW, h, 4)} fill={s.color} opacity={hover === null || hover === i ? 1 : 0.55} />
                    ) : (
                      <rect key={s.key} x={cx - barW / 2} y={top} width={barW} height={h} fill={s.color} opacity={hover === null || hover === i ? 1 : 0.55} />
                    );
                  })}
                  {i % labelEvery === 0 ? (
                    <text x={cx} y={height - 6} textAnchor="middle" className="fill-ink-3 text-[11px]">
                      {d.label}
                    </text>
                  ) : null}
                  <rect
                    x={padLeft + band * i}
                    y={padTop}
                    width={band}
                    height={plotH}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    tabIndex={-1}
                  />
                </g>
              );
            })}
            <line x1={padLeft} x2={width} y1={y(0)} y2={y(0)} stroke="#CDD4DD" strokeWidth={1} shapeRendering="crispEdges" />
          </svg>
        ) : null}
        {hover !== null && data[hover] ? (
          <div
            className="pointer-events-none absolute z-10 min-w-[140px] rounded-md bg-surface px-3 py-2 text-xs shadow-pop"
            style={{
              left: Math.min(Math.max(padLeft + band * hover + band / 2 - 70, 0), Math.max(0, width - 160)),
              top: 0,
            }}
          >
            <p className="mb-1 font-medium text-ink">{data[hover].fullLabel ?? data[hover].label}</p>
            {series.map((s) => (
              <p key={s.key} className="flex items-center justify-between gap-3 text-ink-2">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-[2px]" style={{ background: s.color }} aria-hidden />
                  {s.label}
                </span>
                <span className="font-medium tabular text-ink">{formatValue(data[hover].values[s.key] ?? 0)}</span>
              </p>
            ))}
          </div>
        ) : null}
      </div>
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-ink-3 hover:text-ink">Voir les données</summary>
        <div className="mt-2 max-h-56 overflow-y-auto rounded-sm border border-line">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-subtle">
              <tr>
                <th className="px-2 py-1.5 font-medium text-ink-3">Jour</th>
                {series.map((s) => (
                  <th key={s.key} className="px-2 py-1.5 text-right font-medium text-ink-3">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.key} className="border-t border-line">
                  <td className="px-2 py-1 text-ink-2">{d.fullLabel ?? d.label}</td>
                  {series.map((s) => (
                    <td key={s.key} className="px-2 py-1 text-right tabular">
                      {formatValue(d.values[s.key] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/** Barres horizontales simples (répartition), valeurs en texte. */
export function BarList({ items, formatValue = (n) => n.toLocaleString("fr-FR"), color = "#2563EB" }: { items: { label: string; value: number }[]; formatValue?: (n: number) => string; color?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="flex flex-col gap-3">
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-1 flex items-center justify-between gap-3 text-[13px]">
            <span className="truncate text-ink-2">{i.label}</span>
            <span className="font-medium tabular text-ink">{formatValue(i.value)}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div className="h-1.5 rounded-full" style={{ width: `${Math.max(2, (i.value / max) * 100)}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
