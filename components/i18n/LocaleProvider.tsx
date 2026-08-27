"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Locale = "ar" | "en";
type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  isArabic: boolean;
};

const LocaleContext = createContext<LocaleContextValue>({
  locale: "ar",
  setLocale: () => undefined,
  isArabic: true,
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ar");

  useEffect(() => {
    const stored = window.localStorage.getItem("researchranker-locale");
    const initial: Locale = stored === "en" ? "en" : "ar";
    setLocaleState(initial);
    document.documentElement.lang = initial;
    document.documentElement.dir = initial === "ar" ? "rtl" : "ltr";
  }, []);

  function setLocale(next: Locale) {
    setLocaleState(next);
    window.localStorage.setItem("researchranker-locale", next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
    window.dispatchEvent(new CustomEvent("researchranker-locale", { detail: next }));
  }

  const value = useMemo(
    () => ({ locale, setLocale, isArabic: locale === "ar" }),
    [locale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}
