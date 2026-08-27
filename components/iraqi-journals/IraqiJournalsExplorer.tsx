"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export type IraqiJournal = {
  name: string;
  publisher: string;
  field: string;
  status: "مصنفة" | "محلية" | "تحتاج تحقق";
  quartile: "Q1" | "Q2" | "Q3" | "Q4" | "غير مؤكد";
  indexing: string;
  note: string;
  url?: string;
};

export type JournalNews = {
  title: string;
  tag: string;
  description: string;
};

type LiveNewsItem = {
  title: string;
  source: string;
  link: string;
  date: string;
  summary: string;
  scope: "global" | "iraq";
  provenance: "official" | "editorial";
};

type IraqiJournalsExplorerProps = {
  journals: IraqiJournal[];
  news: JournalNews[];
  alerts: string[];
};

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeText(value: string) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

function statusClass(status: IraqiJournal["status"]) {
  if (status === "مصنفة") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "محلية") return "border-blue-200 bg-blue-50 text-blue-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function quartileClass(quartile: IraqiJournal["quartile"]) {
  if (quartile === "Q1") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (quartile === "Q2") return "border-blue-200 bg-blue-50 text-blue-800";
  if (quartile === "Q3") return "border-amber-200 bg-amber-50 text-amber-800";
  if (quartile === "Q4") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

export default function IraqiJournalsExplorer({
  journals,
  news,
  alerts,
}: IraqiJournalsExplorerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("الكل");
  const [quartileFilter, setQuartileFilter] = useState("الكل");
  const [fieldFilter, setFieldFilter] = useState("الكل");
  const [liveNews, setLiveNews] = useState<LiveNewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadLiveNews() {
      try {
        const response = await fetch("/api/news?scope=iraq", { cache: "no-store" });
        const data = await response.json();
        if (active && response.ok && Array.isArray(data)) {
          setLiveNews(data as LiveNewsItem[]);
        }
      } catch (error) {
        console.error("Iraqi journals news error:", error);
      } finally {
        if (active) setNewsLoading(false);
      }
    }

    loadLiveNews();
    return () => {
      active = false;
    };
  }, []);

  const fields = useMemo(() => {
    const unique = Array.from(new Set(journals.map((journal) => journal.field).filter(Boolean)));
    return ["الكل", ...unique];
  }, [journals]);

  const filteredJournals = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm);

    return journals.filter((journal) => {
      const searchable = normalizeText(
        [journal.name, journal.publisher, journal.field, journal.status, journal.quartile, journal.indexing, journal.note].join(" ")
      );

      return (
        (!normalizedSearch || searchable.includes(normalizedSearch)) &&
        (statusFilter === "الكل" || journal.status === statusFilter) &&
        (quartileFilter === "الكل" || journal.quartile === quartileFilter) &&
        (fieldFilter === "الكل" || journal.field === fieldFilter)
      );
    });
  }, [journals, searchTerm, statusFilter, quartileFilter, fieldFilter]);

  const stats = useMemo(
    () => ({
      total: journals.length,
      local: journals.filter((journal) => journal.status === "محلية").length,
      needsCheck: journals.filter((journal) => journal.status === "تحتاج تحقق").length,
      markedClassified: journals.filter((journal) => journal.status === "مصنفة").length,
    }),
    [journals]
  );

  function resetFilters() {
    setSearchTerm("");
    setStatusFilter("الكل");
    setQuartileFilter("الكل");
    setFieldFilter("الكل");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 sm:px-6 sm:py-7" dir="rtl">
      <section className="mx-auto max-w-7xl">
        <header className="sticky top-3 z-30 mb-5 flex items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-xl">
          <Link href="/dashboard" className="flex items-center gap-3 rounded-xl">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-sm font-black text-white">R</div>
            <div>
              <p className="text-sm font-black text-slate-950">ResearchRanker</p>
              <p className="hidden text-xs text-slate-500 sm:block">Iraqi Journals Intelligence</p>
            </div>
          </Link>
          <div className="flex gap-2">
            <Link href="/journals" className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 sm:inline-flex">تحقق من مجلة</Link>
            <Link href="/search" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white">بحث أكاديمي</Link>
          </div>
        </header>

        <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-slate-950 p-5 text-white shadow-xl sm:p-8">
          <div className="grid gap-7 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Iraq academic publishing monitor</p>
              <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">المجلات العراقية: دليل متابعة، وليس قائمة تصنيف نهائية.</h1>
              <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-300">
                نفصل بين وجود المجلة محلياً وبين إثبات فهرستها وتصنيفها عالمياً. أي Q غير مدعوم بمطابقة هوية ومصدر مناسب يجب أن يبقى “غير مؤكد”.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <a href="https://iasj.rdd.edu.iq/journals/" target="_blank" rel="noopener noreferrer" className="rounded-xl bg-white px-4 py-2.5 text-sm font-black text-slate-950">فتح IASJ</a>
                <a href="https://www.scimagojr.com/journalrank.php" target="_blank" rel="noopener noreferrer" className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-black text-white">فتح SCImago</a>
                <Link href="/journals" className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-black text-white">أداة التحقق بـISSN</Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                [String(stats.total), "مدخل في قائمة المتابعة"],
                [String(stats.local), "موسوم محلياً"],
                [String(stats.needsCheck), "يحتاج تحقق"],
                [String(stats.markedClassified), "موسوم مصنف في البيانات"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                  <p className="text-2xl font-black">{value}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-emerald-700">Official live feed</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">أخبار أكاديمية عراقية ذات صلة بالنشر</h2>
                <p className="mt-2 text-sm leading-7 text-slate-500">تُرشّح من صفحات وزارة التعليم العالي العراقية الرسمية. إذا فشل المصدر، لا نولد خبراً بديلاً.</p>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">LIVE</span>
            </div>

            <div className="mt-5 space-y-3">
              {newsLoading ? (
                [0, 1, 2].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-slate-100" />)
              ) : liveNews.length ? (
                liveNews.slice(0, 5).map((item) => (
                  <a key={item.link} href={item.link} target="_blank" rel="noopener noreferrer" className="group block rounded-2xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-md">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-black text-slate-400">
                      <span>{item.source}</span>
                      {item.date ? <span>• {item.date}</span> : null}
                      <span className="text-emerald-700">• مصدر رسمي</span>
                    </div>
                    <h3 className="mt-2 text-sm font-black leading-6 text-slate-900 group-hover:text-blue-700">{item.title}</h3>
                  </a>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-7 text-slate-600">لا توجد عناصر مطابقة موثوقة حالياً من المصدر الرسمي.</div>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-black uppercase tracking-wider text-blue-700">Research guidance</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">قواعد التحقق قبل الإرسال</h2>
            <div className="mt-5 space-y-3">
              {news.map((item) => (
                <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2"><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-500">{item.tag}</span><h3 className="text-sm font-black text-slate-900">{item.title}</h3></div>
                  <p className="mt-2 text-xs leading-6 text-slate-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-violet-700">Journal watchlist</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">بحث وفلترة قائمة المتابعة</h2>
            </div>
            <button type="button" onClick={resetFilters} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-black text-slate-700">إعادة الضبط</button>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-4">
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="اسم المجلة، الجامعة أو التخصص" className="min-h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:border-blue-300 focus:bg-white lg:col-span-4" />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black"><option value="الكل">كل الحالات</option><option value="مصنفة">مصنفة</option><option value="محلية">محلية</option><option value="تحتاج تحقق">تحتاج تحقق</option></select>
            <select value={quartileFilter} onChange={(event) => setQuartileFilter(event.target.value)} className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black"><option value="الكل">كل الأرباع</option><option value="Q1">Q1</option><option value="Q2">Q2</option><option value="Q3">Q3</option><option value="Q4">Q4</option><option value="غير مؤكد">غير مؤكد</option></select>
            <select value={fieldFilter} onChange={(event) => setFieldFilter(event.target.value)} className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black">{fields.map((item) => <option key={item} value={item}>{item === "الكل" ? "كل التخصصات" : item}</option>)}</select>
            <div className="flex min-h-12 items-center justify-between rounded-xl bg-slate-950 px-4 text-sm font-black text-white"><span>النتائج</span><span>{filteredJournals.length}</span></div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-2">
          {filteredJournals.length ? filteredJournals.map((journal) => {
            const journalParams = new URLSearchParams({ title: journal.name });
            return (
              <article key={journal.name} className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-xl font-black leading-8 text-slate-950">{journal.name}</h3>
                    <p className="mt-1 text-sm font-bold text-slate-500">{journal.publisher}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <span className={`rounded-full border px-3 py-1.5 text-xs font-black ${statusClass(journal.status)}`}>{journal.status}</span>
                    <span className={`rounded-full border px-3 py-1.5 text-xs font-black ${quartileClass(journal.quartile)}`}>{journal.quartile}{journal.quartile !== "غير مؤكد" ? " • يحتاج مصدر" : ""}</span>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[11px] font-black text-slate-400">التخصص</p><p className="mt-1 text-sm font-black text-slate-900">{journal.field}</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[11px] font-black text-slate-400">الفهرسة المدوّنة</p><p className="mt-1 text-sm font-black text-slate-900">{journal.indexing}</p></div>
                </div>

                <p className="mt-4 text-sm leading-7 text-slate-600">{journal.note}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {journal.url ? <a href={journal.url} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white">فتح المصدر المحلي</a> : null}
                  <Link href={`/journals?${journalParams.toString()}`} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-black text-blue-800">تحقق من المجلة</Link>
                </div>
              </article>
            );
          }) : (
            <div className="rounded-[26px] border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-600 lg:col-span-2">لا توجد مجلات مطابقة للفلاتر الحالية.</div>
          )}
        </section>

        <section className="mt-5 rounded-[28px] border border-rose-200 bg-rose-50 p-5 sm:p-6">
          <h2 className="text-xl font-black text-rose-950">تنبيهات النزاهة في التحقق</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {alerts.map((alert) => <div key={alert} className="rounded-2xl border border-rose-100 bg-white p-4 text-sm font-bold leading-7 text-rose-900">{alert}</div>)}
          </div>
        </section>
      </section>
    </main>
  );
}
