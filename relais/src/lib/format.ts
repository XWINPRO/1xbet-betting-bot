import { env } from "@/lib/env";
import type { Locale } from "@/i18n/config";

/**
 * Formats d'affichage (montants, dates, distances) selon la langue.
 * Fuseau horaire : celui de la plateforme (Africa/Douala par défaut).
 * Dans les composants, préférer `f` fourni par getI18n() / useI18n().
 */

export function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function currencyLabel(currency: string | null | undefined) {
  if (!currency || currency === "XAF" || currency === "XOF") return "FCFA";
  return currency;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

type DateInput = string | Date | null | undefined;
type NumInput = number | string | null | undefined;

export type Formatters = {
  money: (amount: NumInput, currency?: string | null) => string;
  number: (value: NumInput) => string;
  date: (value: DateInput) => string;
  shortDate: (value: DateInput) => string;
  time: (value: DateInput) => string;
  dateTime: (value: DateInput) => string;
  weekday: (value: DateInput) => string;
  relative: (value: DateInput, now?: Date) => string;
  distance: (km: NumInput) => string;
  duration: (seconds: number | null | undefined) => string;
};

const cache = new Map<Locale, Formatters>();

export function createFormatters(locale: Locale): Formatters {
  const hit = cache.get(locale);
  if (hit) return hit;
  const tag = locale === "en" ? "en-GB" : "fr-FR";
  const tz = env.timezone;
  const integer = new Intl.NumberFormat(tag, { maximumFractionDigits: 0 });
  const decimal = new Intl.NumberFormat(tag, { maximumFractionDigits: 1 });
  const dateFmt = new Intl.DateTimeFormat(tag, { timeZone: tz, day: "numeric", month: "short", year: "numeric" });
  const shortDateFmt = new Intl.DateTimeFormat(tag, { timeZone: tz, day: "numeric", month: "short" });
  const timeFmt = new Intl.DateTimeFormat(tag, { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  const dateTimeFmt = new Intl.DateTimeFormat(tag, { timeZone: tz, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const weekdayFmt = new Intl.DateTimeFormat(tag, { timeZone: tz, weekday: "short", day: "numeric" });
  const fmt = (f: Intl.DateTimeFormat) => (value: DateInput) => {
    const d = toDate(value);
    return d ? f.format(d) : "—";
  };
  const shortDate = fmt(shortDateFmt);

  const formatters: Formatters = {
    money: (amount, currency) => `${integer.format(toNumber(amount))} ${currencyLabel(currency)}`,
    number: (value) => integer.format(toNumber(value)),
    date: fmt(dateFmt),
    shortDate,
    time: fmt(timeFmt),
    dateTime: fmt(dateTimeFmt),
    weekday: fmt(weekdayFmt),
    relative: (value, now = new Date()) => {
      const d = toDate(value);
      if (!d) return "—";
      const seconds = Math.round((now.getTime() - d.getTime()) / 1000);
      const en = locale === "en";
      if (seconds < 45) return en ? "just now" : "à l'instant";
      if (seconds < 3600) {
        const m = Math.max(1, Math.round(seconds / 60));
        return en ? `${m} min ago` : `il y a ${m} min`;
      }
      if (seconds < 86400) {
        const h = Math.round(seconds / 3600);
        return en ? `${h} h ago` : `il y a ${h} h`;
      }
      if (seconds < 86400 * 7) {
        const j = Math.round(seconds / 86400);
        return en ? `${j} d ago` : `il y a ${j} j`;
      }
      return shortDate(d);
    },
    distance: (km) => {
      if (km === null || km === undefined || km === "") return "—";
      const n = toNumber(km);
      if (n < 1) return `${integer.format(Math.round(n * 1000))} m`;
      return `${decimal.format(n)} km`;
    },
    duration: (seconds) => {
      if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "—";
      const minutes = Math.round(seconds / 60);
      if (minutes < 60) return `${minutes} min`;
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
    },
  };
  cache.set(locale, formatters);
  return formatters;
}

// Raccourcis en français (code non lié à une langue : messages WhatsApp
// générés côté serveur sans contexte, journaux…).
const fr = createFormatters("fr");
export const formatMoney = fr.money;
export const formatNumber = fr.number;
export const formatDate = fr.date;
export const formatShortDate = fr.shortDate;
export const formatTime = fr.time;
export const formatDateTime = fr.dateTime;
export const formatRelative = fr.relative;
export const formatDistanceKm = fr.distance;
export const formatDuration = fr.duration;

export function secondsSince(value: DateInput, now: Date = new Date()): number | null {
  const d = toDate(value);
  if (!d) return null;
  return Math.max(0, Math.round((now.getTime() - d.getTime()) / 1000));
}
