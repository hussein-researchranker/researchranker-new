"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { FormEvent, useEffect, useRef, useState } from "react";

type NewsItem = {
  title: string;
  source: string;
  link: string;
  date: string;
  summary: string;
  scope: "global" | "iraq";
  provenance: "official" | "editorial";
};

type NewsPayload = {
  global?: NewsItem[];
  iraq?: NewsItem[];
  updatedAt?: string;
};

const featureCards = [
  {
    href: "/search",
    eyebrow: "Academic Search",
    title: "البحث الأكاديمي الذكي",
    description: "ابحث بالعنوان أو الكلمات المفتاحية أو DOI بالعربية والإنجليزية مع بيانات المصدر وحالة التحقق.",
    accent: "border-blue-200 bg-blue-50/70 text-blue-700",
    shortcut: "/",
  },
  {
    href: "/journals",
    eyebrow: "Journal Intelligence",
    title: "ذكاء وتصنيف المجلات",
    description: "تحقق من بيانات المجلة، الفهرسة، الربع والمصدر الذي استند إليه التصنيف قبل اتخاذ قرار النشر.",
    accent: "border-violet-200 bg-violet-50/70 text-violet-700",
  },
  {
    href: "/iraqi-journals",
    eyebrow: "Iraqi Journals",
    title: "المجلات العراقية",
    description: "دليل مخصص للمجلات العراقية مع فصل واضح بين البيانات المحلية والمعلومات التي تحتاج تحققاً دولياً.",
    accent: "border-emerald-200 bg-emerald-50/70 text-emerald-700",
  },
  {
    href: "/advanced-search",
    eyebrow: "Research Workspace",
    title: "مساحة الباحث المتقدمة",
    description: "أدوات البحث والتحليل والحفظ المتقدمة في واجهة واحدة للمهام البحثية الطويلة.",
    accent: "border-slate-200 bg-slate-50 text-slate-700",
  },
];

function NewsColumn({
  title,
  subtitle,
  items,
  loading,
}: {
  title: string;
  subtitle: string;
  items: NewsItem[];
  loading: boolean;
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500">
          LIVE
        </span>
      </div>

      {loading ? (
        <div className="space-y-3" aria-label="جاري تحميل الأخبار">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
          لا توجد أخبار موثوقة مطابقة حالياً. لا يعرض ResearchRanker خبراً عند تعذر التحقق من مصدره.
        </div>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 4).map((item) => (
            <a
              key={`${item.source}-${item.link}`}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-2xl border border-slate-200 p-4 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                <span>{item.source}</span>
                {item.date ? <span>• {item.date}</span> : null}
                <span className={item.provenance === "official" ? "text-emerald-700" : "text-blue-700"}>
                  {item.provenance === "official" ? "مصدر رسمي" : "مصدر تحريري معروف"}
                </span>
              </div>
              <h3 className="mt-2 line-clamp-2 text-sm font-black leading-6 text-slate-900 group-hover:text-blue-700">
                {item.title}
              </h3>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

export default function DashboardHome() {
  const [query, setQuery] = useState("");
  const [news, setNews] = useState<NewsPayload>({});
  const [newsLoading, setNewsLoading] = useState(true);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

      if (event.key === "/" && !isTyping) {
        event.preventDefault();
        searchRef.current?.focus();
      }

      if (event.key === "Escape") {
        searchRef.current?.blur();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadNews() {
      try {
        const response = await fetch("/api/news?scope=all", { cache: "no-store" });
        const data = (await response.json()) as NewsPayload;
        if (active && response.ok) setNews(data || {});
      } catch (error) {
        console.error("Dashboard news error:", error);
      } finally {
        if (active) setNewsLoading(false);
      }
    }

    loadNews();
    return () => {
      active = false;
    };
  }, []);

  function submitQuickSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;

    const params = new URLSearchParams({ q: value, quartile: "All", field: "all" });
    window.location.href = `/results?${params.toString()}`;
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#eff6ff_0,#f8fafc_36%,#f8fafc_100%)] px-3 py-4 sm:px-6 sm:py-7" dir="rtl">
      <div className="mx-auto max-w-7xl">
        <header className="sticky top-3 z-30 mb-5 flex items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-xl sm:px-5">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3 rounded-xl">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-950 text-sm font-black text-white">R</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-950">ResearchRanker</p>
              <p className="hidden text-xs font-medium text-slate-500 sm:block">Academic Intelligence Platform</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="التنقل الرئيسي">
            <Link href="/search" className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-950">البحث</Link>
            <Link href="/journals" className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-950">المجلات</Link>
            <Link href="/iraqi-journals" className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-950">العراقية</Link>
            <Link href="/advanced-search" className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-950">متقدم</Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/search" className="hidden rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white sm:inline-flex">بحث جديد</Link>
            <UserButton />
          </div>
        </header>

        <section className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-slate-950 p-5 text-white shadow-2xl shadow-slate-200/60 sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.25fr_.75fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-blue-100">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                منصة بحث أكاديمي موثّقة المصدر
              </div>
              <h1 className="mt-5 max-w-3xl text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
                ابحث. تحقّق. لخّص. ثم اتخذ قرارك البحثي على أساس واضح.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-8 text-slate-300 sm:text-base">
                ResearchRanker يجمع البحث العلمي، التحقق من بيانات المجلات، الأخبار الأكاديمية، والوصول المفتوح في مسار واحد مع إظهار مصدر كل معلومة بدلاً من إخفاء عدم اليقين.
              </p>

              <form onSubmit={submitQuickSearch} className="mt-7 flex flex-col gap-2 rounded-2xl bg-white p-2 shadow-xl sm:flex-row" role="search">
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="عنوان بحث، كلمات مفتاحية عربية/إنجليزية، أو DOI"
                  aria-label="بحث أكاديمي سريع"
                  className="min-h-12 flex-1 rounded-xl border-0 bg-transparent px-4 text-sm font-medium text-slate-950 outline-none placeholder:text-slate-400"
                />
                <button type="submit" disabled={!query.trim()} className="min-h-12 rounded-xl bg-blue-600 px-6 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                  بحث أكاديمي
                </button>
              </form>
              <p className="mt-2 text-xs text-slate-400">اختصار لوحة المفاتيح: اضغط / للانتقال مباشرة إلى البحث، و Esc للخروج من الحقل.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                ["DOI", "بحث مباشر بالمعرّف"],
                ["AR / EN", "بحث عربي وإنجليزي"],
                ["Q1–Q4", "تصنيف مع مصدر"],
                ["OA", "فحص الوصول المفتوح"],
              ].map(([value, label]) => (
                <div key={value} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
                  <p className="text-xl font-black text-white">{value}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {featureCards.map((card) => (
            <Link key={card.href} href={card.href} className={`group rounded-[26px] border p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${card.accent}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-wider opacity-80">{card.eyebrow}</p>
                {card.shortcut ? <kbd className="rounded-lg border border-current/20 bg-white/70 px-2 py-1 text-[11px] font-black">{card.shortcut}</kbd> : null}
              </div>
              <h2 className="mt-5 text-xl font-black text-slate-950">{card.title}</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">{card.description}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-black">فتح الأداة <span aria-hidden>←</span></span>
            </Link>
          ))}
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-2">
          <NewsColumn
            title="أخبار النشر العالمية"
            subtitle="مصادر متخصصة في النشر العلمي والنزاهة البحثية؛ الخبر يبقى مرتبطاً بمصدره الأصلي."
            items={news.global || []}
            loading={newsLoading}
          />
          <NewsColumn
            title="أخبار أكاديمية عراقية ذات صلة"
            subtitle="تُسحب فقط من صفحات رسمية عراقية وتُرشّح للموضوعات المتعلقة بالمجلات والنشر والفهرسة."
            items={news.iraq || []}
            loading={newsLoading}
          />
        </section>

        <section className="mt-5 grid gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-3 sm:p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-emerald-700">Verification policy</p>
            <h3 className="mt-2 font-black text-slate-950">لا نخمّن التصنيف</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">إذا لم تتوفر مطابقة قوية عبر ISSN أو مصدر موثوق، يظهر التصنيف كغير مؤكد بدلاً من إعطاء Q خاطئ.</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-blue-700">AI policy</p>
            <h3 className="mt-2 font-black text-slate-950">التلخيص مقيد بالنص المتاح</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">التلخيص يجب أن يعتمد على العنوان والملخص المتاحين، مع إظهار القيود عندما لا تتوفر تفاصيل الدراسة.</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-violet-700">Source policy</p>
            <h3 className="mt-2 font-black text-slate-950">كل خبر له مصدر</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">لا تُنشأ أخبار تلقائياً بواسطة الذكاء الاصطناعي؛ المعروض مقتبس كعنوان من المصدر ويرتبط بالرابط الأصلي.</p>
          </div>
        </section>

        <footer className="py-8 text-center text-xs font-medium text-slate-400">
          ResearchRanker • Academic metadata must always be verified against the cited data source before formal evaluation or submission.
        </footer>
      </div>
    </main>
  );
}
