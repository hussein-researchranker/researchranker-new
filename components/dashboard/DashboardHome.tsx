"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import NewsSlider from "@/app/components/NewsSlider";

type LibrarySummary = {
  saved: number;
  verified: number;
};

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isVerifiedQuartile(article: {
  quartile?: string;
  matchConfidence?: string;
}) {
  const quartile = cleanText(article.quartile);
  const confidence = cleanText(article.matchConfidence).toLowerCase();

  return (
    /^Q[1-4]$/.test(quartile) &&
    (confidence.includes("issn exact match") ||
      confidence.includes("journal title exact match") ||
      confidence.includes("strict token match"))
  );
}

export default function DashboardHome() {
  const [librarySummary, setLibrarySummary] = useState<LibrarySummary>({
    saved: 0,
    verified: 0,
  });

  useEffect(() => {
    async function loadSummary() {
      try {
        const response = await fetch("/api/library/list", { cache: "no-store" });
        if (!response.ok) return;

        const data = await response.json();
        const articles = Array.isArray(data?.articles) ? data.articles : [];

        setLibrarySummary({
          saved: articles.length,
          verified: articles.filter(isVerifiedQuartile).length,
        });
      } catch {
        // Keep the dashboard usable even when the visitor is signed out.
      }
    }

    loadSummary();
  }, []);

  const quickActions = [
    {
      href: "/search",
      eyebrow: "Literature discovery",
      title: "ابحث عن مصادر علمية",
      description:
        "ابدأ من موضوع أو DOI، ثم راجع بيانات المجلة والتصنيف والوصول المفتوح في مكان واحد.",
      accent: "from-blue-600 to-indigo-600",
      badge: "ابدأ البحث",
    },
    {
      href: "/library",
      eyebrow: "Research library",
      title: "مكتبتي البحثية",
      description:
        "اجمع المصادر المهمة، انسخ الاقتباسات، وصدّر قائمتك بدل فقدان الأوراق بين عمليات البحث.",
      accent: "from-emerald-500 to-teal-600",
      badge: `${librarySummary.saved} محفوظ`,
    },
    {
      href: "/journals",
      eyebrow: "Journal intelligence",
      title: "استكشف المجلات والتصنيفات",
      description:
        "راجع الربع والمؤشرات المتاحة مع إبقاء الحالات غير المؤكدة واضحة بدل عرض تصنيف مضلل.",
      accent: "from-violet-500 to-purple-600",
      badge: "Q1–Q4",
    },
    {
      href: "/iraqi-journals",
      eyebrow: "Local publishing",
      title: "المجلات العراقية",
      description:
        "وصول سريع إلى المجلات العراقية والبيانات التي تهم الباحث عند اختيار وجهة النشر.",
      accent: "from-amber-500 to-orange-600",
      badge: "Iraqi journals",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f6f8fb]" dir="rtl">
      <AppHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-slate-950 px-6 py-9 text-white shadow-xl sm:px-9 lg:px-12 lg:py-12">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.32),transparent_35%),radial-gradient(circle_at_90%_80%,rgba(99,102,241,0.28),transparent_30%)]" />
          <div className="relative grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-blue-100 backdrop-blur">
                ResearchRanker • Research workspace
              </div>
              <h1 className="mt-5 max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                من سؤال بحثي إلى مصدر موثوق، في مسار واحد واضح.
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-8 text-slate-300 sm:text-base">
                ابحث، افحص بيانات المجلة، راجع التصنيف، تحقق من الوصول المفتوح،
                احفظ المصدر، وارجع إليه لاحقاً من مكتبتك البحثية.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/search"
                  className="rounded-xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm hover:bg-blue-50"
                >
                  ابدأ بحثاً جديداً
                </Link>
                <Link
                  href="/library"
                  className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white backdrop-blur hover:bg-white/15"
                >
                  افتح مكتبتي
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur">
                <p className="text-xs font-bold text-slate-300">مصادر محفوظة</p>
                <p className="mt-2 text-3xl font-black">{librarySummary.saved}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur">
                <p className="text-xs font-bold text-slate-300">تصنيف موثّق</p>
                <p className="mt-2 text-3xl font-black">{librarySummary.verified}</p>
              </div>
              <div className="col-span-2 rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur">
                <p className="text-xs font-bold text-slate-300">منهج التحقق</p>
                <p className="mt-2 text-sm font-bold leading-6 text-white">
                  PubMed / Crossref / OpenAlex + مطابقة صارمة مع بيانات SCImago
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
                Core workflows
              </p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                كل ما تحتاجه للوصول إلى قرار بحثي أفضل
              </h2>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {quickActions.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl"
              >
                <div className={`h-1.5 bg-gradient-to-r ${item.accent}`} />
                <div className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                      {item.eyebrow}
                    </p>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">
                      {item.badge}
                    </span>
                  </div>
                  <h3 className="mt-5 text-xl font-black leading-7 text-slate-950">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {item.description}
                  </p>
                  <p className="mt-5 text-xs font-black text-blue-700 group-hover:text-blue-800">
                    فتح القسم ←
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Research flow
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">
              مسار عمل مقترح للباحث
            </h2>

            <div className="mt-6 space-y-4">
              {[
                ["01", "حدّد سؤالك", "اكتب موضوعاً واضحاً أو DOI أو كلمات مفتاحية دقيقة."],
                ["02", "راجع الأدلة", "افحص المجلة والربع ومصدر البيانات قبل الاعتماد على النتيجة."],
                ["03", "احفظ المهم", "أضف الأوراق المناسبة إلى مكتبتك بدل إعادة البحث عنها."],
                ["04", "استخدم المخرجات", "انسخ الاقتباس أو صدّر قائمتك عند الكتابة والمراجعة."],
              ].map(([number, title, description]) => (
                <div key={number} className="flex gap-4 rounded-2xl bg-slate-50 p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-950 text-xs font-black text-white">
                    {number}
                  </span>
                  <div>
                    <h3 className="text-sm font-black text-slate-950">{title}</h3>
                    <p className="mt-1 text-xs leading-6 text-slate-600">
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <NewsSlider />
        </section>

        <section className="mt-8 rounded-3xl border border-blue-100 bg-gradient-to-l from-blue-50 to-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
                Built for research decisions
              </p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">
                المنصة لا تعرض الربع كحقيقة عندما لا تستطيع التحقق منه.
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                هذه نقطة أساسية في تصميم ResearchRanker: الحالات غير المؤكدة تبقى
                غير مؤكدة، مع إظهار سبب المطابقة أو الحاجة إلى التحقق اليدوي.
              </p>
            </div>
            <Link
              href="/search"
              className="shrink-0 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-blue-700"
            >
              جرّب البحث
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
