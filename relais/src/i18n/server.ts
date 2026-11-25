import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { isLocale, localeFromAcceptLanguage, LOCALE_COOKIE, type Locale } from "./config";
import { makeI18n } from "./translate";

export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(value)) return value;
  return localeFromAcceptLanguage((await headers()).get("accept-language"));
});

export const getI18n = cache(async () => makeI18n(await getLocale()));
