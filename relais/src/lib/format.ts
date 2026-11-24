import { env } from "@/lib/env";

const integerFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function currencyLabel(currency: string | null | undefined) {
  if (!currency || currency === "XAF" || currency === "XOF") return "FCFA";
  return currency;
}

/** 12 500 FCFA */
export function formatMoney(amount: number | string | null | undefined, currency?: string | null) {
  return `${integerFormat.format(toNumber(amount))} ${currencyLabel(currency)}`;
}

export function formatNumber(value: number | string | null | undefined) {
  return integerFormat.format(toNumber(value));
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const dateFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: env.timezone, day: "numeric", month: "short", year: "numeric" });
const shortDateFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: env.timezone, day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: env.timezone, hour: "2-digit", minute: "2-digit" });
const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: env.timezone,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value: string | Date | null | undefined) {
  const d = toDate(value);
  return d ? dateFmt.format(d) : "—";
}
export function formatShortDate(value: string | Date | null | undefined) {
  const d = toDate(value);
  return d ? shortDateFmt.format(d) : "—";
}
export function formatTime(value: string | Date | null | undefined) {
  const d = toDate(value);
  return d ? timeFmt.format(d) : "—";
}
export function formatDateTime(value: string | Date | null | undefined) {
  const d = toDate(value);
  return d ? dateTimeFmt.format(d) : "—";
}

/** « il y a 4 min », « il y a 2 h », sinon date courte. */
export function formatRelative(value: string | Date | null | undefined, now: Date = new Date()) {
  const d = toDate(value);
  if (!d) return "—";
  const seconds = Math.round((now.getTime() - d.getTime()) / 1000);
  if (seconds < 0) return "à l'instant";
  if (seconds < 45) return "à l'instant";
  if (seconds < 3600) return `il y a ${Math.max(1, Math.round(seconds / 60))} min`;
  if (seconds < 86400) return `il y a ${Math.round(seconds / 3600)} h`;
  if (seconds < 86400 * 7) return `il y a ${Math.round(seconds / 86400)} j`;
  return formatShortDate(d);
}

export function secondsSince(value: string | Date | null | undefined, now: Date = new Date()): number | null {
  const d = toDate(value);
  if (!d) return null;
  return Math.max(0, Math.round((now.getTime() - d.getTime()) / 1000));
}

export function formatDistanceKm(km: number | string | null | undefined) {
  if (km === null || km === undefined || km === "") return "—";
  const n = toNumber(km);
  if (n < 1) return `${integerFormat.format(Math.round(n * 1000))} m`;
  return `${decimalFormat.format(n)} km`;
}

export function formatDuration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "—";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

export function pluralize(count: number, singular: string, plural?: string) {
  return `${formatNumber(count)} ${count > 1 ? plural ?? `${singular}s` : singular}`;
}
