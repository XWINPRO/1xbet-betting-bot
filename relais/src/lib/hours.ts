import type { OpeningHoursDay } from "@/types/domain";

/** Horaires par défaut : lundi–samedi 08:00–19:00, dimanche fermé. */
export function defaultHours(): OpeningHoursDay[] {
  return Array.from({ length: 7 }, (_, i) => ({ day: i + 1, closed: i === 6, open: "08:00", close: "19:00" }));
}
