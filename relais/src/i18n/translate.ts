import { en } from "./en";
import type { Locale } from "./config";
import { createFormatters, type Formatters } from "@/lib/format";

export type Vars = Record<string, string | number>;

/**
 * Traduction façon gettext : le texte français sert de clé, le dictionnaire
 * anglais fournit la traduction. Une clé absente retombe sur le français.
 * Les nombres d'un message dynamique (« 120 caractères maximum ») sont
 * reconnus via un motif « {n} caractères maximum ».
 */
const NUMBER = /\d+(?:[.,]\d+)?/g;

function interpolate(text: string, vars?: Vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

export function translate(locale: Locale, key: string, vars?: Vars): string {
  if (locale === "fr" || !key) return interpolate(key, vars);
  const hit = en[key];
  if (hit !== undefined) return interpolate(hit, vars);
  const numbers = key.match(NUMBER);
  if (numbers) {
    const pattern = en[key.replace(NUMBER, "{n}")];
    if (pattern !== undefined) {
      let i = 0;
      return interpolate(pattern.replace(/\{n\}/g, () => numbers[i++] ?? ""), vars);
    }
  }
  return interpolate(key, vars);
}

export type I18n = {
  locale: Locale;
  /** Traduit un texte français. */
  t: (key: string, vars?: Vars) => string;
  /** Singulier / pluriel selon n ; {n} est remplacé par le nombre formaté. */
  tn: (n: number, one: string, other: string, vars?: Vars) => string;
  f: Formatters;
};

export function makeI18n(locale: Locale): I18n {
  const f = createFormatters(locale);
  return {
    locale,
    f,
    t: (key, vars) => translate(locale, key, vars),
    tn: (n, one, other, vars) => {
      const singular = locale === "fr" ? Math.abs(n) < 2 : Math.abs(n) === 1;
      return translate(locale, singular ? one : other, { n: f.number(n), ...vars });
    },
  };
}
