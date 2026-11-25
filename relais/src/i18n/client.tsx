"use client";

import * as React from "react";
import type { Locale } from "./config";
import { makeI18n, type I18n } from "./translate";

const I18nContext = React.createContext<I18n>(makeI18n("fr"));

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = React.useMemo(() => makeI18n(locale), [locale]);
  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n() {
  return React.useContext(I18nContext);
}
