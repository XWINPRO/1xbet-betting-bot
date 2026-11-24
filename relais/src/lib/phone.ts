import { env } from "@/lib/env";

/**
 * Normalise un numéro au format international E.164 (+237690000000).
 * Un numéro local (9 chiffres au Cameroun) reçoit l'indicatif par défaut.
 */
export function normalizePhone(input: string | null | undefined, countryCode = env.defaultCountryCode): string | null {
  if (!input) return null;
  const raw = input.trim().replace(/[^\d+]/g, "");
  if (!raw) return null;
  let digits: string;
  if (raw.startsWith("+")) digits = raw.slice(1).replace(/\D/g, "");
  else if (raw.startsWith("00")) digits = raw.slice(2);
  else if (countryCode && raw.length <= 9) digits = countryCode + raw.replace(/^0+/, "");
  else digits = raw;
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

export function isValidPhone(input: string | null | undefined) {
  return normalizePhone(input) !== null;
}

/** Chiffres uniquement, pour les liens wa.me / tel:. */
export function phoneDigits(input: string | null | undefined): string | null {
  const n = normalizePhone(input);
  return n ? n.slice(1) : null;
}

/** +237 6 90 00 00 01 pour le Cameroun, regroupement générique sinon. */
export function formatPhone(input: string | null | undefined): string {
  if (!input) return "—";
  const n = normalizePhone(input);
  if (!n) return input;
  const d = n.slice(1);
  if (d.startsWith("237") && d.length === 12) {
    const local = d.slice(3);
    return `+237 ${local[0]} ${local.slice(1, 3)} ${local.slice(3, 5)} ${local.slice(5, 7)} ${local.slice(7, 9)}`;
  }
  return `+${d.replace(/(\d{3})(?=\d)/g, "$1 ")}`;
}

export function telHref(input: string | null | undefined): string | null {
  const n = normalizePhone(input);
  return n ? `tel:${n}` : null;
}
