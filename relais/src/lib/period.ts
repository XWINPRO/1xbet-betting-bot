import { env } from "@/lib/env";

export type PeriodKey = "today" | "7d" | "30d" | "90d";

export const PERIODS: { key: PeriodKey; label: string; days: number }[] = [
  { key: "today", label: "Aujourd'hui", days: 1 },
  { key: "7d", label: "7 jours", days: 7 },
  { key: "30d", label: "30 jours", days: 30 },
  { key: "90d", label: "90 jours", days: 90 },
];

function zonedParts(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute"), s: get("second") };
}

/** Décalage (minutes) du fuseau par rapport à UTC à cet instant. */
function offsetMinutes(date: Date, tz: string) {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** Minuit (heure locale du fuseau) du jour contenant `date`. */
export function zonedStartOfDay(date: Date, tz = env.timezone): Date {
  const p = zonedParts(date, tz);
  const offset = offsetMinutes(date, tz);
  return new Date(Date.UTC(p.y, p.m - 1, p.d) - offset * 60000);
}

/** Date locale AAAA-MM-JJ dans le fuseau. */
export function zonedDateString(date: Date, tz = env.timezone): string {
  const p = zonedParts(date, tz);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export function resolvePeriod(key: string | undefined, now = new Date()) {
  const period = PERIODS.find((p) => p.key === key) ?? PERIODS[1];
  const startToday = zonedStartOfDay(now);
  const from = new Date(startToday.getTime() - (period.days - 1) * 86400000);
  return {
    key: period.key,
    label: period.label,
    days: period.days,
    from,
    to: now,
    fromDate: zonedDateString(from),
    toDate: zonedDateString(now),
  };
}
