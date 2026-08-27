"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import NewsSlider from "@/app/components/NewsSlider";
import { useLocale } from "@/components/i18n/LocaleProvider";

type Summary = { saved: number; verified: number; alerts: number };

function clean(value: unknown) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function verified(article: { quartile?: string; matchConfidence?: string }) {
  const confidence = clean(article.matchConfidence).toLowerCase();
  return /^Q[1-4]$/.test(clean(article.quartile)) && (confidence.includes("issn exact match") || confidence.includes("journal title exact match") || confidence.includes("strict token match"));
}

export default function DashboardHome() {
  const { isArabic } = useLocale();
  const [summary, setSummary] = useState<Summary>({ saved: 0, verified: 0, alerts: 0 });

  useEffect(() => {
    async function load() {
      try {
        const [libraryResponse, alertsResponse] = await Promise.all([
          fetch("/api/library/list", { cache: "no-store" }),
          fetch("/api/alerts", { cache: "no-store" }),
        ]);
        const libraryData = libraryResponse.ok ? await libraryResponse.json() : { articles: [] };
        const alertData = alertsResponse.ok ? await alertsResponse.json() : { alerts: [] };
        const articles = Array.isArray(libraryData.articles) ? libraryData.articles : [];
        const alerts = Array.isArray(alertData.alerts) ? alertData.alerts : [];
        setSummary({ saved: articles.length, verified: articles.filter(verified).length, alerts: alerts.filter((item: { read?: boolean }) => !item.read).length });
      } catch {
        // Dashboard remains usable while signed out or during transient API failures.
      }
    }
    load();
  }, []);

  const modules = [
    { href: "/search", ar: "البحث عن الأدلة", en: "Evidence Search", descAr: "ابحث في المصادر العلمية ثم راجع بيانات المجلة وحالة التحقق قبل الاعتماد على النتيجة.", descEn: "Search scholarly sources and inspect journal evidence before relying on a result.", badge: isArabic ? "ابدأ" : "Start", accent: "from-blue-600 to-indigo-600" },
    { href: "/library", ar: "المكتبة البحثية V2", en: "Research Library V2", descAr: "مجموعات ووسوم وملاحظات ومفضلة وحالة قراءة وتصدير BibTeX وRIS وZotero.", descEn: "Collections, tags, notes, favorites, reading states, and BibTeX/RIS/Zotero export.", badge: `${summary.saved}`, accent: "from-emerald-500 to-teal-600" },
    { href: "/alerts", ar: "البحوث المحفوظة والتنبيهات", en: "Saved Searches & Alerts", descAr: "احفظ استراتيجية البحث واكتشف الأوراق الجديدة مع relevance scoring.", descEn: "Save search strategies and surface new papers with relevance scoring.", badge: `${summary.alerts}`, accent: "from-cyan-500 to-blue-600" },
    { href: "/review", ar: "المراجعة المنهجية", en: "Systematic Review", descAr: "Include / Exclude / Maybe، أسباب الاستبعاد، كشف التكرار، PRISMA واستخراج البيانات.", descEn: "Screening decisions, exclusion reasons, duplicate checks, PRISMA, and data extraction.", badge: "PRISMA", accent: "from-violet-500 to-purple-600" },
    { href: "/assistant", ar: "المساعد البحثي الموثق", en: "Grounded AI Assistant", descAr: "اسأل فقط المصادر الموجودة في مكتبتك واحصل على synthesis مع citation markers لكل claim.", descEn: "Ask only your selected library sources and receive synthesis with claim-level citation markers.", badge: "AI", accent: "from-fuchsia-500 to-pink-600" },
    { href: "/journal-finder", ar: "اختيار مجلة للنشر", en: "Journal Finder", descAr: "رتب المجلات المرشحة حسب صلتها بموضوع المخطوطة وحالة التحقق من بياناتها.", descEn: "Rank candidate journals by manuscript relevance and verified journal evidence.", badge: "Q1–Q4", accent: "from-amber-500 to-orange-600" },
    { href: "/journals", ar: "ذكاء المجلات", en: "Journal Intelligence", descAr: "استكشف بيانات المجلات والتصنيفات مع إبقاء الحالات غير الموثقة واضحة.", descEn: "Explore journal metrics while keeping unverified classifications explicit.", badge: `${summary.verified}`, accent: "from-slate-600 to-slate-900" },
    { href: "/iraqi-journals", ar: "المجلات العراقية", en: "Iraqi Journals", descAr: "بوابة محلية تساعد الباحث العراقي في مراجعة وجهات النشر والبيانات المتاحة.", descEn: "A local publishing gateway for Iraqi researchers and available journal evidence.", badge: "IQ", accent: "from-red-500 to-rose-600" },
  ];

  return (
    <div className="min-h-screen bg-[#f6f8fb]" dir={isArabic ? "rtl" : "ltr"}>
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[34px] bg-slate-950 px-6 py-10 text-white shadow-2xl sm:px-10 lg:px-12 lg:py-14">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(37,99,235,0.38),transparent_34%),radial-gradient(circle_at_88%_82%,rgba(124,58,237,0.28),transparent_30%)]" />
          <div className="relative grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
            <div><div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black text-blue-100">ResearchRanker</div><h1 className="mt-5 max-w-4xl text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">{isArabic ? "من سؤال بحثي إلى قرار موثق، في مساحة عمل واحدة." : "From a research question to a verifiable decision, in one workspace."}</h1><p className="mt-5 max-w-3xl text-sm leading-8 text-slate-300 sm:text-base">{isArabic ? "اكتشاف الأدلة، تقييم المجلات، إدارة المراجع، المراجعات المنهجية، خرائط العلاقات، والتنبيهات ضمن منصة مصممة لتقليل الادعاءات غير الموثقة." : "Discover evidence, evaluate journals, manage references, run systematic-review workflows, explore paper networks, and monitor new research with explicit verification states."}</p><div className="mt-7 flex flex-wrap gap-3"><Link href="/search" className="rounded-xl bg-white px-5 py-3 text-sm font-black text-slate-950">{isArabic ? "ابدأ بحثاً" : "Start a search"}</Link><Link href="/library" className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black">{isArabic ? "افتح المكتبة" : "Open library"}</Link></div></div>
            <div className="grid grid-cols-3 gap-3"><Kpi label={isArabic ? "مصادر" : "Sources"} value={summary.saved} /><Kpi label={isArabic ? "موثّق" : "Verified"} value={summary.verified} /><Kpi label={isArabic ? "تنبيهات" : "Alerts"} value={summary.alerts} /></div>
          </div>
        </section>

        <section className="mt-8"><div className="mb-4"><p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">{isArabic ? "مساحات العمل" : "Workspaces"}</p><h2 className="mt-1 text-2xl font-black text-slate-950">{isArabic ? "اختر المهمة البحثية التي تريد تنفيذها" : "Choose the research task you want to perform"}</h2></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{modules.map((module) => <Link key={module.href} href={module.href} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"><div className={`h-1.5 bg-gradient-to-r ${module.accent}`} /><div className="p-5"><div className="flex items-start justify-between gap-3"><h3 className="text-lg font-black leading-7 text-slate-950">{isArabic ? module.ar : module.en}</h3><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">{module.badge}</span></div><p className="mt-3 text-sm leading-7 text-slate-600">{isArabic ? module.descAr : module.descEn}</p><p className="mt-5 text-xs font-black text-blue-700">{isArabic ? "فتح المساحة ←" : "Open workspace →"}</p></div></Link>)}</div></section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]"><div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{isArabic ? "مبدأ المنصة" : "Platform principle"}</p><h2 className="mt-2 text-2xl font-black text-slate-950">{isArabic ? "عدم اليقين يبقى ظاهراً." : "Uncertainty stays visible."}</h2><p className="mt-3 text-sm leading-7 text-slate-600">{isArabic ? "إذا لم نستطع توثيق تصنيف مجلة أو حالة ورقة، لا نحول التخمين إلى حقيقة. تظهر مصادر البيانات ودرجة المطابقة والتحذيرات حتى يستطيع الباحث اتخاذ القرار بنفسه." : "If a journal classification or paper status cannot be verified, ResearchRanker does not turn an inference into a fact. Data sources, match confidence, and warnings remain visible."}</p><div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">PubMed</span><span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">Crossref</span><span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">OpenAlex</span><span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">SCImago</span></div></div><NewsSlider /></section>
      </main>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-center backdrop-blur"><p className="text-[10px] font-bold text-slate-300">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>; }
