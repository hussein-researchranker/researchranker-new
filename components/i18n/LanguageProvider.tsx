"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Locale = "ar" | "en";

const translations = {
  ar: {
    "brand.subtitle": "مساحة ذكاء بحثي موثّق",
    "nav.home": "الرئيسية",
    "nav.search": "البحث",
    "nav.library": "مكتبتي",
    "nav.workspace": "مساحة العمل",
    "nav.workspaceShort": "العمل",
    "nav.review": "المراجعة المنهجية",
    "nav.reviewShort": "المراجعة",
    "nav.alerts": "التنبيهات",
    "nav.journals": "المجلات",
    "nav.iraqiJournals": "المجلات العراقية",
    "nav.newSearch": "بحث جديد",
    "library.export": "تصدير المكتبة",
    "auth.signIn": "دخول",
    "language.toggle": "التبديل إلى الإنجليزية",
    "mobile.navigation": "التنقل الرئيسي للهاتف",
  },
  en: {
    "brand.subtitle": "Evidence-grounded research intelligence",
    "nav.home": "Home",
    "nav.search": "Search",
    "nav.library": "Library",
    "nav.workspace": "Workspace",
    "nav.workspaceShort": "Work",
    "nav.review": "Systematic Review",
    "nav.reviewShort": "Review",
    "nav.alerts": "Alerts",
    "nav.journals": "Journals",
    "nav.iraqiJournals": "Iraqi Journals",
    "nav.newSearch": "New Search",
    "library.export": "Export library",
    "auth.signIn": "Sign in",
    "language.toggle": "Switch to Arabic",
    "mobile.navigation": "Primary mobile navigation",
  },
} as const;

type TranslationKey = keyof (typeof translations)["ar"];

type LanguageContextValue = {
  locale: Locale;
  dir: "rtl" | "ltr";
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);
const STORAGE_KEY = "researchranker.locale";
const COOKIE_NAME = "rr_locale";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ar");

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
      document.cookie = `${COOKIE_NAME}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    } catch {
      // Persistence is optional; the in-memory language still changes.
    }
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "ar" || stored === "en") {
        setLocaleState(stored);
      }
    } catch {
      // Keep Arabic as the deterministic default.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const toggleLocale = useCallback(() => {
    setLocale(locale === "ar" ? "en" : "ar");
  }, [locale, setLocale]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      dir: locale === "ar" ? "rtl" : "ltr",
      setLocale,
      toggleLocale,
      t: (key) => translations[locale][key],
    }),
    [locale, setLocale, toggleLocale]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return context;
}
