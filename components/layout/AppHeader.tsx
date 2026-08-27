"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";

const desktopNavItems = [
  { href: "/dashboard", label: "الرئيسية" },
  { href: "/search", label: "البحث" },
  { href: "/library", label: "مكتبتي" },
  { href: "/workspace", label: "مساحة العمل" },
  { href: "/review", label: "المراجعة المنهجية" },
  { href: "/alerts", label: "التنبيهات" },
  { href: "/journals", label: "المجلات" },
  { href: "/iraqi-journals", label: "المجلات العراقية" },
];

const mobileNavItems = [
  { href: "/dashboard", label: "الرئيسية", icon: "⌂" },
  { href: "/search", label: "البحث", icon: "⌕" },
  { href: "/library", label: "مكتبتي", icon: "▤" },
  { href: "/workspace", label: "العمل", icon: "◆" },
  { href: "/review", label: "المراجعة", icon: "✓" },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard" || pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppHeader() {
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useAuth();

  return (
    <>
      <header
        className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl"
        dir="rtl"
      >
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-lg font-black text-white shadow-sm">
              R
            </span>
            <span className="min-w-0 sm:block">
              <span className="block truncate text-sm font-black tracking-tight text-slate-950">
                ResearchRanker
              </span>
              <span className="hidden truncate text-[11px] font-semibold text-slate-500 sm:block">
                مساحة ذكاء بحثي موثّق
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

          <div className="mr-auto flex shrink-0 items-center gap-2 md:mr-0">
            <Link
              href="/alerts"
              className="hidden rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 sm:inline-flex md:hidden"
            >
              التنبيهات
            </Link>
            <Link
              href="/search"
              className="hidden rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800 xl:inline-flex"
            >
              بحث جديد
            </Link>
            {!isLoaded ? (
              <span
                className="h-9 w-9 animate-pulse rounded-full bg-slate-200"
                aria-hidden="true"
              />
            ) : isSignedIn ? (
              <UserButton
                appearance={{ elements: { avatarBox: "h-9 w-9" } }}
              />
            ) : (
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  دخول
                </button>
              </SignInButton>
            )}
          </div>
        </div>
      </header>

      <nav
        className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-5 gap-1 rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-2xl backdrop-blur-xl md:hidden"
        dir="rtl"
        aria-label="التنقل الرئيسي للهاتف"
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
