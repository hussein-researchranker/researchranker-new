"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import { useLanguage } from "@/components/i18n/LanguageProvider";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppHeader() {
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useAuth();
  const { locale, dir, toggleLocale, t } = useLanguage();

  const desktopNavItems = [
    { href: "/", label: t("nav.home") },
    { href: "/search", label: t("nav.search") },
    { href: "/library", label: t("nav.library") },
    { href: "/workspace", label: t("nav.workspace") },
    { href: "/review", label: t("nav.review") },
    { href: "/alerts", label: t("nav.alerts") },
    { href: "/journals", label: t("nav.journals") },
    { href: "/iraqi-journals", label: t("nav.iraqiJournals") },
  ];

  const mobileNavItems = [
    { href: "/", label: t("nav.home"), icon: "⌂" },
    { href: "/search", label: t("nav.search"), icon: "⌕" },
    { href: "/library", label: t("nav.library"), icon: "▤" },
    { href: "/workspace", label: t("nav.workspaceShort"), icon: "◆" },
    { href: "/review", label: t("nav.reviewShort"), icon: "✓" },
  ];

  return (
    <>
      <header
        className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl"
        dir={dir}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="ResearchRanker home">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-lg font-black text-white shadow-sm">
              R
            </span>
            <span className="min-w-0 sm:block">
              <span className="block truncate text-sm font-black tracking-tight text-slate-950">
                ResearchRanker
              </span>
              <span className="hidden truncate text-[11px] font-semibold text-slate-500 sm:block">
                {t("brand.subtitle")}
              </span>
            </span>
          </Link>

          <nav className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-2xl bg-slate-50 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex">
            {desktopNavItems.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition lg:text-sm ${
                    active
                      ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-600 hover:bg-white hover:text-slate-950"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ms-auto flex shrink-0 items-center gap-2 md:ms-0">
            <Link
              href="/dashboard"
              aria-label={locale === "ar" ? "لوحة الباحث" : "Research dashboard"}
              title={locale === "ar" ? "لوحة الباحث" : "Research dashboard"}
              className="hidden rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:border-blue-200 hover:text-blue-700 lg:inline-flex"
            >
              {locale === "ar" ? "لوحة الباحث" : "Dashboard"}
            </Link>
            <Link
              href="/library/export"
              aria-label={t("library.export")}
              title={t("library.export")}
              className="grid h-9 min-w-9 place-items-center rounded-xl border border-slate-300 bg-white px-2 text-base font-black text-slate-700 hover:bg-slate-50"
            >
              ⇩
            </Link>
            <button
              type="button"
              onClick={toggleLocale}
              aria-label={t("language.toggle")}
              title={t("language.toggle")}
              className="grid h-9 min-w-9 place-items-center rounded-xl border border-slate-300 bg-white px-2 text-xs font-black text-slate-700 hover:bg-slate-50"
            >
              {locale === "ar" ? "EN" : "ع"}
            </button>
            <Link
              href="/search"
              className="hidden rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 xl:inline-flex"
            >
              {t("nav.newSearch")}
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
                  {t("auth.signIn")}
                </button>
              </SignInButton>
            )}
          </div>
        </div>
      </header>

      <nav
        className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-5 gap-1 rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-2xl backdrop-blur-xl md:hidden"
        dir={dir}
        aria-label={t("mobile.navigation")}
      >
        {mobileNavItems.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center justify-center rounded-xl px-1 py-2 text-center transition ${
                active ? "bg-slate-950 text-white" : "text-slate-500"
              }`}
            >
              <span className="text-base font-black leading-none" aria-hidden="true">
                {item.icon}
              </span>
              <span className="mt-1 max-w-full truncate text-[10px] font-black">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
