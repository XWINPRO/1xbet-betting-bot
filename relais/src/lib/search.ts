/** Nettoie une recherche libre pour un filtre PostgREST .or(...ilike...). */
export function sanitizeSearch(q: string | undefined | null): string | null {
  if (!q) return null;
  const cleaned = q.replace(/[,()%*\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return cleaned.length ? cleaned : null;
}

export function pageNumber(value: string | undefined) {
  const n = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10000) : 1;
}
