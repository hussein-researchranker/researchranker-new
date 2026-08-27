"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import { useLocale } from "@/components/i18n/LocaleProvider";

const navItems = [
  { href: "/dashboard", ar: "الرئيسية", en: "Home" },
  { href: "/search", ar: "البحث", en: "Search" },
  { href: "/library", ar: "مكتبتي", en: "Library" },
  { href: "/alerts", ar: "التنبيهات", en: "Alerts" },
  { href: "/review", ar: "المراجعة المنهجية", en: "Systematic Review" },
  { href: "/assistant", ar: "المساعد", en: "AI Assistant" },
  { href: "/journal-finder", ar: "اختيار مجلة", en: "Journal Finder" },
  { href: "/journals", ar: "المجلات", en: "Journals" },
  { href: "/iraqi-journals", ar: "المجلات العراقية", en: "Iraqi Journals" },
];

const mobileItems = [
  { href: "/dashboard", ar: "الرئيسية", en: "Home", icon: "⌂" },
  { href: "/search", ar: "بحث", en: "Search", icon: "⌕" },
  { href: "/library", ar: "مكتبتي", en: "Library", icon: "▤" },
  { href: "/alerts", ar: "تنبيهات", en: "Alerts", icon: "◉" },
  { href: "/review", ar: "مراجعة", en: "Review", icon: "✓" },
];

const ALERT_CHECK_STORAGE_KEY = "researchranker-last-alert-check";
const ALERT_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppHeader() {
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useAuth();
  const { locale, setLocale, isArabic } = useLocale();
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  useEffect(() => {
    if (!isSignedIn) {
      setUnreadAlerts(0);
      return;
    }

    let cancelled = false;

    async function refreshAlerts() {
      try {
        const response = await fetch("/api/alerts", { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const data = await response.json();
        const alerts = Array.isArray(data?.alerts) ? data.alerts : [];
        if (!cancelled) {
          setUnreadAlerts(alerts.filter((alert: { read?: boolean }) => !alert.read).length);
        }
      } catch {
        // Alert count is non-critical.
      }
    }

    refreshAlerts();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshAlerts();
    }, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isSignedIn, pathname]);

  useEffect(() => {
    if (!isSignedIn) return;

    const lastCheck = Number(window.localStorage.getItem(ALERT_CHECK_STORAGE_KEY) || "0");
    if (Date.now() - lastCheck < ALERT_CHECK_INTERVAL_MS) return;

    let cancelled = false;

    async function checkSavedSearches() {
      try {
        const response = await fetch("/api/alerts/check", { method: "POST" });
        if (!response.ok || cancelled) return;

        window.localStorage.setItem(ALERT_CHECK_STORAGE_KEY, String(Date.now()));
        const alertsResponse = await fetch("/api/alerts", { cache: "no-store" });
        if (!alertsResponse.ok || cancelled) return;
        const data = await alertsResponse.json();
        const alerts = Array.isArray(data?.alerts) ? data.alerts : [];
        setUnreadAlerts(alerts.filter((alert: { read?: boolean }) => !alert.read).length);
      } catch {
        // Automatic checks are opportunistic. The manual check remains available.
      }
    }

    const idle = window.setTimeout(checkSavedSearches, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(idle);
    };
  }, [isSignedIn]);

  return (
    <>
      <header
        className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl"
        dir={isArabic ? "rtl" : "ltr"}
      >
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-3 py-3 sm:px-5 lg:px-6">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-lg font-black text-white shadow-sm">
              R
            </span>
            <span className="hidden min-w-0 xl:block">
              <span className="block truncate text-sm font-black tracking-tight text-slate-950">
                ResearchRanker
              </span>
              <span className="block truncate text-[11px] font-semibold text-slate-500">
                {isArabic ? "مساحة ذكاء بحثي موثوق" : "Scholarly intelligence workspace"}
              </span>
            </span>
          </Link>

          <nav
            id="researchranker-primary-nav"
            className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-2xl bg-slate-50 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex"
          >
            {navItems.map((item) => {
              const active = isActive(pathname, item.href);
              const alertsItem = item.href === "/alerts";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative whitespace-nowrap rounded-xl px-3 py-2 text-[11px] font-bold transition sm:text-xs ${
                    active
                      ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-600 hover:bg-white hover:text-slate-950"
                  }`}
                >
                  <span>{locale === "ar" ? item.ar : item.en}</span>
                  {alertsItem && unreadAlerts > 0 ? (
                    <span className="ms-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-black text-white">
                      {unreadAlerts > 99 ? "99+" : unreadAlerts}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="ms-auto flex shrink-0 items-center gap-2 md:ms-0">
            <button
              type="button"
              onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
              aria-label={isArabic ? "Switch to English" : "التبديل إلى العربية"}
            >
              {isArabic ? "EN" : "AR"}
            </button>

            <Link
              href="/search"
              className="hidden rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800 2xl:inline-flex"
            >
              {isArabic ? "بحث جديد" : "New search"}
            </Link>

            {!isLoaded ? (
              <span className="h-9 w-9 animate-pulse rounded-full bg-slate-200" aria-hidden="true" />
            ) : isSignedIn ? (
              <UserButton appearance={{ elements: { avatarBox: "h-9 w-9" } }} />
            ) : (
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  {isArabic ? "دخول" : "Sign in"}
                </button>
              </SignInButton>
            )}
          </div>
        </div>
      </header>

      <nav
        className="researchranker-mobile-nav fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-slate-200 bg-white/95 px-1 pt-1 backdrop-blur-xl md:hidden"
        dir={isArabic ? "rtl" : "ltr"}
        aria-label={isArabic ? "التنقل الرئيسي للهاتف" : "Mobile primary navigation"}
      >
        {mobileItems.map((item) => {
          const active = isActive(pathname, item.href);
          const alertsItem = item.href === "/alerts";
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-w-0 flex-col items-center justify-center rounded-xl px-1 py-2 text-[10px] font-black ${
                active ? "bg-blue-50 text-blue-700" : "text-slate-500"
              }`}
            >
              <span className="text-lg leading-none" aria-hidden="true">
                {item.icon}
              </span>
              <span className="mt-1 max-w-full truncate">
                {locale === "ar" ? item.ar : item.en}
              </span>
              {alertsItem && unreadAlerts > 0 ? (
                <span className="absolute end-2 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-blue-600 px-1 text-[8px] text-white">
                  {unreadAlerts > 9 ? "9+" : unreadAlerts}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
