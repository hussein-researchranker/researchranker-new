"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import { useLanguage } from "@/components/i18n/LanguageProvider";

type GlobalNewsItem = {
  title: string;
  source: string;
  link: string;
  date: string;
  summary: string;
};

type LocalNewsItem = {
  title: string;
  tag: string;
  description: string;
  source?: string;
  date?: string;
  url?: string;
};

type HomeLandingProps = {
  localNews: LocalNewsItem[];
};

function ArrowIcon({ rtl }: { rtl: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none">
      <path
        d={rtl ? "M12.5 4.5 7 10l5.5 5.5M7.5 10H16" : "M7.5 4.5 13 10l-5.5 5.5M12.5 10H4"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none">
      <path d="M12 3.5 19 6v5.4c0 4.4-2.8 7.8-7 9.1-4.2-1.3-7-4.7-7-9.1V6l7-2.5Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RadarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 12 18 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none">
      <path d="M5 4.5h10.5A2.5 2.5 0 0 1 18 7v12.5H7.5A2.5 2.5 0 0 1 5 17V4.5Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 8h7M8 11.5h7M8 15h4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function cleanText(value: unknown) {
  return String(value ?? "")
    .replaceAll("â€™", "’")
    .replaceAll("â€œ", "“")
    .replaceAll("â€", "”")
    .replaceAll("â€“", "–")
    .replaceAll("<![CDATA[", "")
    .replaceAll("]]>", "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function HomeLanding({ localNews }: HomeLandingProps) {
  const { locale, dir } = useLanguage();
  const isAr = locale === "ar";
  const rtl = dir === "rtl";
  const [query, setQuery] = useState("");
  const [globalNews, setGlobalNews] = useState<GlobalNewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsScope, setNewsScope] = useState<"global" | "iraq">("global");

  const text = useMemo(
    () => ({
      eyebrow: isAr ? "منصة ذكاء بحثي للباحث العربي" : "Research intelligence for better decisions",
      titleA: isAr ? "ابحث. تحقّق. تابع." : "Search. Verify. Stay ahead.",
      titleB: isAr ? "واتخذ قرار النشر بثقة." : "Make publishing decisions with confidence.",
      subtitle: isAr
        ? "ResearchRanker يجمع اكتشاف الأدبيات، معلومات المجلات، التحقق من التصنيف، الأخبار الأكاديمية، والمجلات العراقية في مسار واحد سريع وواضح."
        : "ResearchRanker brings literature discovery, journal intelligence, quartile verification, scholarly news, and Iraqi journals into one clear workflow.",
      searchPlaceholder: isAr
        ? "اكتب موضوع البحث، عنواناً، DOI أو PMID..."
        : "Enter a research topic, title, DOI or PMID...",
      searchButton: isAr ? "ابدأ البحث" : "Start research",
      suggestions: isAr ? "جرّب:" : "Try:",
      globalPulse: isAr ? "نبض النشر العالمي" : "Global publishing pulse",
      localPulse: isAr ? "تحديثات العراق" : "Iraq updates",
      pulseTitle: isAr ? "آخر ما يهم الباحث قبل أن يختار مجلة" : "What researchers should know before choosing a journal",
      pulseSubtitle: isAr
        ? "مصادر موثوقة حول الفهرسة، النزاهة العلمية، الوصول المفتوح، النشر، والتطورات العراقية ذات الصلة."
        : "Trusted updates on indexing, research integrity, open access, publishing, and relevant Iraqi research developments.",
      readSource: isAr ? "فتح المصدر" : "Open source",
      localHub: isAr ? "استكشف المجلات العراقية" : "Explore Iraqi journals",
      globalEmpty: isAr ? "الأخبار العالمية غير متاحة مؤقتاً. بقية المنصة تعمل بصورة طبيعية." : "Global news is temporarily unavailable. The rest of the platform remains available.",
      workflows: isAr ? "اختصارات الباحث" : "Research workflows",
      workflowsTitle: isAr ? "أربع وجهات، بدون تضييع وقت" : "Four destinations, no wasted clicks",
      verification: isAr ? "طبقة تحقق واضحة" : "A visible verification layer",
      verificationTitle: isAr ? "لا نعرض الربع كحقيقة إذا لم تتوفر أدلة كافية" : "Quartiles are not presented as facts without sufficient evidence",
      verificationBody: isAr
        ? "المطابقة الموثقة تعتمد على ISSN أو اسم مجلة مطابق بدقة أو تطابق رمزي صارم. إذا لم تكفِ الأدلة، تبقى الحالة غير مؤكدة بدلاً من التخمين."
        : "Verified matching relies on ISSN, exact journal-title evidence, or strict token matching. When evidence is insufficient, the result stays unverified instead of being guessed.",
      startNow: isAr ? "ابدأ الآن" : "Start now",
      dashboard: isAr ? "لوحة الباحث" : "Research dashboard",
      builtFor: isAr ? "مصمم للقرار البحثي، لا لزيادة عدد النقرات" : "Built for research decisions, not more clicks",
    }),
    [isAr]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadNews() {
      try {
        const response = await fetch("/api/news", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) {
          setGlobalNews(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) setGlobalNews([]);
      } finally {
        if (!cancelled) setNewsLoading(false);
      }
    }

    loadNews();
    return () => {
      cancelled = true;
    };
  }, []);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = query.trim();
    window.location.href = cleaned ? `/search?q=${encodeURIComponent(cleaned)}` : "/search";
  }

  const quickActions = [
    {
      href: "/search",
      number: "01",
      title: isAr ? "اكتشاف الأدبيات" : "Literature discovery",
      body: isAr ? "ابحث بعنوان، كلمات مفتاحية، DOI أو PMID ثم فلتر حسب التخصص والربع." : "Search by title, keywords, DOI, or PMID and refine by field and quartile.",
      icon: <SearchIcon />,
    },
    {
      href: "/journals",
      number: "02",
      title: isAr ? "ذكاء المجلات" : "Journal intelligence",
      body: isAr ? "راجع التصنيف ومصدر المطابقة قبل أن تعتبر Q1–Q4 معلومة مؤكدة." : "Review ranking evidence and match provenance before trusting Q1–Q4 labels.",
      icon: <ShieldIcon />,
    },
    {
      href: "/iraqi-journals",
      number: "03",
      title: isAr ? "المجلات العراقية" : "Iraqi journals",
      body: isAr ? "وصول سريع إلى المشهد المحلي مع تنبيهات تحقق واضحة للباحث العراقي." : "A focused local view with clear verification warnings for Iraqi researchers.",
      icon: <RadarIcon />,
    },
    {
      href: "/library",
      number: "04",
      title: isAr ? "مكتبتي البحثية" : "Research library",
      body: isAr ? "احفظ الأوراق المهمة وارجع لها وصدّر مراجعك من مكان واحد." : "Save important papers, revisit them, and export references from one place.",
      icon: <LibraryIcon />,
    },
  ];

  const sampleQueries = isAr
    ? ["الذكاء الاصطناعي في المختبرات", "Zonulin in hemodialysis", "10.1016/..."]
    : ["AI in laboratory medicine", "Zonulin in hemodialysis", "10.1016/..."];

  const visibleGlobalNews = globalNews.slice(0, 4);
  const visibleLocalNews = localNews.slice(0, 4);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f4f7fb]" dir={dir}>
      <AppHeader />

      <main>
        <section className="relative isolate overflow-hidden border-b border-slate-200/80 bg-white">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-36 end-[-5rem] h-[28rem] w-[28rem] rounded-full bg-blue-200/45 blur-3xl" />
            <div className="absolute bottom-[-12rem] start-[-8rem] h-[30rem] w-[30rem] rounded-full bg-indigo-200/40 blur-3xl" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:42px_42px] [mask-image:linear-gradient(to_bottom,black,transparent_88%)]" />
          </div>

          <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-14 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-[1.14fr_0.86fr] lg:items-center lg:px-8 lg:pb-20 lg:pt-20">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/90 px-3.5 py-2 text-xs font-black text-blue-800 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                {text.eyebrow}
              </div>

              <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[1.12] tracking-[-0.035em] text-slate-950 sm:text-5xl lg:text-[4rem]">
                {text.titleA}
                <span className="mt-1 block bg-gradient-to-l from-blue-700 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  {text.titleB}
                </span>
              </h1>

              <p className="mt-6 max-w-2xl text-base font-medium leading-8 text-slate-600 sm:text-lg">
                {text.subtitle}
              </p>

              <form
                onSubmit={submitSearch}
                className="mt-8 max-w-3xl rounded-[26px] border border-slate-200 bg-white p-2 shadow-[0_22px_60px_-28px_rgba(15,23,42,0.35)] ring-1 ring-slate-100 focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-100/70"
              >
                <div className="flex items-center gap-2">
                  <span className="ms-3 text-slate-400">
                    <SearchIcon />
                  </span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={text.searchPlaceholder}
                    aria-label={text.searchPlaceholder}
                    className="min-w-0 flex-1 bg-transparent px-2 py-3.5 text-sm font-bold text-slate-950 outline-none placeholder:font-medium placeholder:text-slate-400 sm:text-base"
                  />
                  <button
                    type="submit"
                    className="inline-flex shrink-0 items-center gap-2 rounded-[18px] bg-slate-950 px-4 py-3.5 text-sm font-black text-white shadow-sm hover:bg-blue-700 sm:px-6"
                  >
                    <span className="hidden sm:inline">{text.searchButton}</span>
                    <ArrowIcon rtl={rtl} />
                  </button>
                </div>
              </form>

              <div className="mt-4 flex max-w-3xl flex-wrap items-center gap-2">
                <span className="text-xs font-black text-slate-500">{text.suggestions}</span>
                {sampleQueries.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setQuery(item)}
                    className="rounded-full border border-slate-200 bg-white/85 px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm hover:border-blue-200 hover:text-blue-700"
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs font-bold text-slate-500">
                <span className="inline-flex items-center gap-2 text-emerald-700">
                  <ShieldIcon />
                  {isAr ? "تحقق محافظ، بدون تخمين" : "Conservative verification, no guessing"}
                </span>
                <span>PubMed</span>
                <span>Crossref</span>
                <span>OpenAlex</span>
                <span>SCImago evidence</span>
              </div>
            </div>

            <aside className="relative overflow-hidden rounded-[32px] border border-slate-800 bg-slate-950 p-6 text-white shadow-2xl sm:p-7">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(59,130,246,0.34),transparent_34%),radial-gradient(circle_at_100%_100%,rgba(124,58,237,0.28),transparent_38%)]" />
              <div className="relative">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-300">Research Pulse</p>
                    <h2 className="mt-2 text-xl font-black">{isAr ? "مركز قرار الباحث" : "Research decision center"}</h2>
                  </div>
                  <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/10 text-blue-200 backdrop-blur">
                    <RadarIcon />
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-2.5">
                  {[
                    ["Q1–Q4", isAr ? "فلترة" : "Filtering"],
                    ["ISSN", isAr ? "دليل" : "Evidence"],
                    ["AR / EN", isAr ? "واجهة" : "Interface"],
                  ].map(([value, label]) => (
                    <div key={value} className="rounded-2xl border border-white/10 bg-white/[0.07] p-3.5 backdrop-blur">
                      <p className="text-base font-black text-white sm:text-lg">{value}</p>
                      <p className="mt-1 text-[10px] font-bold text-slate-400">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.06] p-5">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <ShieldIcon />
                    <p className="text-xs font-black uppercase tracking-[0.12em]">Verification signal</p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {[
                      isAr ? "مطابقة ISSN الدقيقة أولاً" : "Exact ISSN evidence first",
                      isAr ? "مطابقة الاسم الصارمة عند الحاجة" : "Strict title matching when needed",
                      isAr ? "غير مؤكد إذا لم تكفِ الأدلة" : "Unverified when evidence is insufficient",
                    ].map((item, index) => (
                      <div key={item} className="flex items-center gap-3">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/10 text-[10px] font-black text-blue-200">0{index + 1}</span>
                        <p className="text-xs font-bold leading-5 text-slate-200">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-black text-slate-950 hover:bg-blue-50">
                    {text.dashboard}
                    <ArrowIcon rtl={rtl} />
                  </Link>
                  <Link href="/iraqi-journals" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-xs font-black text-white hover:bg-white/15">
                    {isAr ? "المشهد العراقي" : "Iraq journal hub"}
                    <ArrowIcon rtl={rtl} />
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">{text.workflows}</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{text.workflowsTitle}</h2>
            </div>
            <p className="max-w-xl text-sm font-medium leading-7 text-slate-600">
              {isAr ? "الواجهة الرئيسية توجه المستخدم مباشرة إلى المهمة التي يريدها، بينما تبقى الأدوات المتقدمة داخل أقسامها المتخصصة." : "The homepage routes users directly to the task they need while advanced controls stay inside their dedicated workflows."}
            </p>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {quickActions.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl"
              >
                <div className="absolute -end-8 -top-8 h-24 w-24 rounded-full bg-blue-50 transition group-hover:scale-125 group-hover:bg-blue-100" />
                <div className="relative flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-white shadow-sm group-hover:bg-blue-700">{item.icon}</span>
                  <span className="font-mono text-xs font-bold text-slate-300">{item.number}</span>
                </div>
                <h3 className="relative mt-6 text-lg font-black text-slate-950">{item.title}</h3>
                <p className="relative mt-3 text-sm font-medium leading-7 text-slate-600">{item.body}</p>
                <span className="relative mt-5 inline-flex items-center gap-2 text-xs font-black text-blue-700">
                  {isAr ? "فتح" : "Open"}
                  <ArrowIcon rtl={rtl} />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Journal & Publishing Intelligence</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{text.pulseTitle}</h2>
                <p className="mt-3 text-sm font-medium leading-7 text-slate-600">{text.pulseSubtitle}</p>
              </div>

              <div className="inline-flex w-fit rounded-2xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setNewsScope("global")}
                  aria-pressed={newsScope === "global"}
                  className={`rounded-xl px-4 py-2.5 text-xs font-black ${newsScope === "global" ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}
                >
                  {text.globalPulse}
                </button>
                <button
                  type="button"
                  onClick={() => setNewsScope("iraq")}
                  aria-pressed={newsScope === "iraq"}
                  className={`rounded-xl px-4 py-2.5 text-xs font-black ${newsScope === "iraq" ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}
                >
                  {text.localPulse}
                </button>
              </div>
            </div>

            {newsScope === "global" ? (
              newsLoading ? (
                <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Loading journal news">
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="h-64 animate-pulse rounded-[26px] border border-slate-200 bg-slate-100" />
                  ))}
                </div>
              ) : visibleGlobalNews.length ? (
                <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {visibleGlobalNews.map((item, index) => (
                    <a
                      key={`${item.link}-${index}`}
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex min-h-64 flex-col rounded-[26px] border border-slate-200 bg-[#fbfcfe] p-5 transition hover:-translate-y-1 hover:border-violet-200 hover:bg-white hover:shadow-xl"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-black text-violet-700">{cleanText(item.source)}</span>
                        <span className="text-[10px] font-bold text-slate-400">{item.date}</span>
                      </div>
                      <h3 className="mt-5 line-clamp-3 text-base font-black leading-6 text-slate-950">{cleanText(item.title)}</h3>
                      <p className="mt-3 line-clamp-3 text-xs font-medium leading-6 text-slate-600">{cleanText(item.summary)}</p>
                      <span className="mt-auto inline-flex items-center gap-2 pt-5 text-xs font-black text-violet-700">
                        {text.readSource}
                        <ArrowIcon rtl={rtl} />
                      </span>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="mt-7 rounded-[26px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-bold text-slate-600">{text.globalEmpty}</div>
              )
            ) : (
              <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {visibleLocalNews.map((item, index) => {
                  const content = (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">{item.tag}</span>
                        <span className="text-[10px] font-bold text-slate-400">{item.date || "Iraq"}</span>
                      </div>
                      <h3 className="mt-5 line-clamp-3 text-base font-black leading-6 text-slate-950">{item.title}</h3>
                      <p className="mt-3 line-clamp-4 text-xs font-medium leading-6 text-slate-600">{item.description}</p>
                      <span className="mt-auto inline-flex items-center gap-2 pt-5 text-xs font-black text-emerald-700">
                        {item.url ? text.readSource : text.localHub}
                        <ArrowIcon rtl={rtl} />
                      </span>
                    </>
                  );

                  return item.url ? (
                    <a
                      key={`${item.title}-${index}`}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex min-h-64 flex-col rounded-[26px] border border-slate-200 bg-[#fbfcfe] p-5 transition hover:-translate-y-1 hover:border-emerald-200 hover:bg-white hover:shadow-xl"
                    >
                      {content}
                    </a>
                  ) : (
                    <Link
                      key={`${item.title}-${index}`}
                      href="/iraqi-journals"
                      className="group flex min-h-64 flex-col rounded-[26px] border border-slate-200 bg-[#fbfcfe] p-5 transition hover:-translate-y-1 hover:border-emerald-200 hover:bg-white hover:shadow-xl"
                    >
                      {content}
                    </Link>
                  );
                })}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3 text-[11px] font-bold text-slate-500">
              <span>{isAr ? "مصادر عالمية:" : "Global sources:"}</span>
              <span>The Scholarly Kitchen</span>
              <span>Retraction Watch</span>
              <span>Crossref</span>
              <span className="text-slate-300">•</span>
              <span>{isAr ? "المصدر المحلي الرسمي عند توفره: وزارة التعليم العالي والبحث العلمي العراقية" : "Official local source when available: Iraqi Ministry of Higher Education and Scientific Research"}</span>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-5 px-4 py-12 sm:px-6 lg:grid-cols-[1.04fr_0.96fr] lg:px-8 lg:py-16">
          <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-slate-950 p-7 text-white shadow-xl sm:p-9">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">{text.verification}</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-black leading-tight">{text.verificationTitle}</h2>
            <p className="mt-5 max-w-2xl text-sm font-medium leading-7 text-slate-300">{text.verificationBody}</p>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {[
                ["ISSN", isAr ? "الأولوية للدليل المباشر" : "Direct evidence first"],
                ["Title", isAr ? "تطابق دقيق لا جزئي" : "Exact, not loose matching"],
                ["Status", isAr ? "عدم التأكد يظهر بوضوح" : "Uncertainty stays visible"],
              ].map(([label, detail]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                  <p className="text-sm font-black text-white">{label}</p>
                  <p className="mt-2 text-xs font-medium leading-5 text-slate-400">{detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-7 shadow-sm sm:p-9">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Research workflow</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">{text.builtFor}</h2>
            <div className="mt-7 space-y-3">
              {[
                ["01", isAr ? "ابدأ بالسؤال" : "Start with the question", isAr ? "ابحث عن الأدلة بدل البدء باسم مجلة عشوائية." : "Find evidence before starting from a random journal name."],
                ["02", isAr ? "تحقق من المجلة" : "Verify the journal", isAr ? "راجع الربع والفهرسة ومصدر المطابقة." : "Review quartile, indexing, and match provenance."],
                ["03", isAr ? "احفظ واتخذ القرار" : "Save and decide", isAr ? "احتفظ بالأوراق المهمة داخل مكتبتك ومساحة عملك." : "Keep useful papers inside your library and workspace."],
              ].map(([number, title, body]) => (
                <div key={number} className="flex gap-4 rounded-2xl border border-white bg-white/80 p-4 shadow-sm">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-700 text-[11px] font-black text-white">{number}</span>
                  <div>
                    <h3 className="text-sm font-black text-slate-950">{title}</h3>
                    <p className="mt-1 text-xs font-medium leading-5 text-slate-600">{body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/search" className="inline-flex items-center gap-2 rounded-2xl bg-blue-700 px-5 py-3 text-xs font-black text-white shadow-sm hover:bg-blue-800">
                {text.startNow}
                <ArrowIcon rtl={rtl} />
              </Link>
              <Link href="/review" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black text-slate-700 hover:border-blue-200 hover:text-blue-700">
                {isAr ? "المراجعة المنهجية" : "Systematic review"}
                <ArrowIcon rtl={rtl} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-7 text-xs font-bold text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <p>ResearchRanker · {isAr ? "ذكاء بحثي قائم على أدلة واضحة" : "Evidence-grounded research intelligence"}</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/journals" className="hover:text-slate-950">{isAr ? "المجلات" : "Journals"}</Link>
            <Link href="/iraqi-journals" className="hover:text-slate-950">{isAr ? "العراق" : "Iraq"}</Link>
            <Link href="/alerts" className="hover:text-slate-950">{isAr ? "التنبيهات" : "Alerts"}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
