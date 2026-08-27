"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { useEffect, useMemo, useRef, useState } from "react";

type Article = {
  id?: string;
  pmid?: string;
  title?: string;
  journal?: string;
  pubdate?: string;
  authors?: string;
  doi?: string;
  abstract?: string;
  quartile?: string;
  indexingStatus?: string;
  sjr?: string;
  hIndex?: string;
  publisher?: string;
  issn?: string;
  matchConfidence?: string;
  source?: string;
  sourceUrl?: string;
  pubmedUrl?: string;
};

type CitationStyle = "IEEE" | "Vancouver" | "APA";
type SortMode = "relevance" | "newest" | "quartile";

type PdfCheckResult = {
  available: boolean;
  doi?: string;
  isOpenAccess?: boolean;
  oaStatus?: string;
  pdfUrl?: string;
  landingPageUrl?: string;
  license?: string;
  version?: string;
  hostType?: string;
  message?: string;
  error?: string;
};

type AiSummary = {
  objective?: string;
  methodology?: string;
  keyFindings?: string[];
  conclusion?: string;
  researchValue?: string;
  limitationNote?: string;
  evidenceBasis?: "abstract" | "title-only" | "insufficient";
  evidenceNotes?: string[];
};

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function getParam(name: string, fallback = "") {
  if (typeof window === "undefined") return fallback;
  return new URLSearchParams(window.location.search).get(name) || fallback;
}

function looksLikeDoi(value: string) {
  return /10\.\d{4,9}\//i.test(value);
}

function extractYear(value: string) {
  const match = cleanText(value).match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : 0;
}

function doiUrl(doi: string) {
  const value = cleanText(doi);
  return value ? `https://doi.org/${value}` : "";
}

function articleKey(article: Article, index = 0) {
  return cleanText(article.doi) || cleanText(article.pmid) || cleanText(article.id) || `${cleanText(article.title)}-${index}`;
}

function hasStrictIssnQuartile(article: Article) {
  const quartile = cleanText(article.quartile);
  const confidence = cleanText(article.matchConfidence).toLowerCase();
  return /^Q[1-4]$/.test(quartile) && confidence.includes("issn exact match");
}

function safeQuartile(article: Article) {
  return hasStrictIssnQuartile(article) ? cleanText(article.quartile) : "";
}

function quartileRank(value: string) {
  if (value === "Q1") return 1;
  if (value === "Q2") return 2;
  if (value === "Q3") return 3;
  if (value === "Q4") return 4;
  return 9;
}

function quartileClass(value: string) {
  if (value === "Q1") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (value === "Q2") return "border-blue-200 bg-blue-50 text-blue-800";
  if (value === "Q3") return "border-amber-200 bg-amber-50 text-amber-800";
  if (value === "Q4") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

function formatCitation(article: Article, style: CitationStyle, index: number) {
  const authors = cleanText(article.authors) || "Unknown author";
  const title = cleanText(article.title) || "Untitled article";
  const journal = cleanText(article.journal) || "Unknown journal";
  const pubdate = cleanText(article.pubdate) || "n.d.";
  const year = extractYear(pubdate) || "n.d.";
  const doi = cleanText(article.doi);

  if (style === "Vancouver") {
    return `${index}. ${authors}. ${title}. ${journal}. ${pubdate}.${doi ? ` doi: ${doi}.` : ""}`;
  }

  if (style === "APA") {
    return `${authors}. (${year}). ${title}. ${journal}.${doi ? ` ${doiUrl(doi)}` : ""}`;
  }

  return `[${index}] ${authors}, “${title},” ${journal}, ${pubdate}.${doi ? ` doi: ${doi}.` : ""}`;
}

function verificationText(article: Article) {
  if (hasStrictIssnQuartile(article)) {
    return "مطابقة ISSN دقيقة مع بيانات SCImago المحلية (Snapshot).";
  }

  const confidence = cleanText(article.matchConfidence);
  if (confidence) {
    return `${confidence}. لم نعتبر الربع مؤكداً دون مطابقة ISSN دقيقة.`;
  }

  return "هوية المجلة أو الربع غير متحققين بما يكفي.";
}

export default function ResultsPage() {
  const [query, setQuery] = useState("");
  const [quartilePreference, setQuartilePreference] = useState("All");
  const [field, setField] = useState("all");
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [filterText, setFilterText] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("relevance");
  const [citationStyle, setCitationStyle] = useState<CitationStyle>("IEEE");
  const [summaries, setSummaries] = useState<Record<string, AiSummary>>({});
  const [summaryLoading, setSummaryLoading] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [pdfLoading, setPdfLoading] = useState<Record<string, boolean>>({});
  const [pdfResults, setPdfResults] = useState<Record<string, PdfCheckResult>>({});
  const filterRef = useRef<HTMLInputElement | null>(null);

  const isDoiSearch = useMemo(() => looksLikeDoi(query), [query]);

  useEffect(() => {
    const q = getParam("q");
    const requestedQuartile = getParam("quartile", "All");
    const requestedField = getParam("field", "all");

    setQuery(q);
    setQuartilePreference(requestedQuartile);
    setField(requestedField);

    if (!q.trim()) {
      setLoading(false);
      setMessage("لا يوجد استعلام بحث. ابدأ بحثاً جديداً.");
      return;
    }

    let active = true;

    async function loadResults() {
      try {
        setLoading(true);
        setMessage("");

        const params = new URLSearchParams({
          query: q.trim(),
          fromYear: "1900",
          toYear: new Date().getFullYear().toString(),
          maxResults: "50",
          field: looksLikeDoi(q) ? "all" : requestedField,
        });

        const response = await fetch(`/api/global-search?${params.toString()}`, {
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || "Search failed.");
        }

        if (!Array.isArray(data)) {
          throw new Error("Unexpected search response.");
        }

        if (active) {
          setArticles(data as Article[]);
          if (data.length === 0) {
            setMessage("لم تُعثر المصادر المتصلة على نتيجة لهذا الاستعلام. جرّب كلمات أكثر تحديداً أو DOI كاملاً.");
          }
        }
      } catch (error) {
        console.error("Results page search error:", error);
        if (active) {
          setMessage(error instanceof Error ? error.message : "فشل تحميل نتائج البحث.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadResults();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (event.key === "/" && !typing) {
        event.preventDefault();
        filterRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const displayedArticles = useMemo(() => {
    const normalized = filterText.trim().toLowerCase();
    let list = normalized
      ? articles.filter((article) =>
          [article.title, article.journal, article.authors, article.doi, article.issn, article.publisher]
            .map(cleanText)
            .join(" ")
            .toLowerCase()
            .includes(normalized)
        )
      : [...articles];

    if (sortMode === "newest") {
      list = [...list].sort((a, b) => extractYear(cleanText(b.pubdate)) - extractYear(cleanText(a.pubdate)));
    } else if (sortMode === "quartile") {
      list = [...list].sort((a, b) => quartileRank(safeQuartile(a)) - quartileRank(safeQuartile(b)));
    } else if (quartilePreference !== "All" && !isDoiSearch) {
      list = [...list].sort((a, b) => {
        const aMatch = safeQuartile(a) === quartilePreference ? 0 : 1;
        const bMatch = safeQuartile(b) === quartilePreference ? 0 : 1;
        return aMatch - bMatch;
      });
    }

    return list;
  }, [articles, filterText, sortMode, quartilePreference, isDoiSearch]);

  const strictQuartileCount = useMemo(
    () => articles.filter(hasStrictIssnQuartile).length,
    [articles]
  );

  async function copyCitation(article: Article, index: number) {
    try {
      await navigator.clipboard.writeText(formatCitation(article, citationStyle, index + 1));
      setMessage("تم نسخ الاقتباس.");
    } catch {
      setMessage("تعذر نسخ الاقتباس.");
    }
  }

  async function saveArticle(article: Article, index: number) {
    const key = articleKey(article, index);
    try {
      setSaving((current) => ({ ...current, [key]: true }));
      const response = await fetch("/api/library/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: article.id || article.doi || article.pmid || article.title,
          pmid: article.pmid,
          title: article.title,
          journal: article.journal,
          pubdate: article.pubdate,
          authors: article.authors,
          doi: article.doi,
          abstract: article.abstract,
          quartile: safeQuartile(article) || "Not verified",
          indexingStatus: article.indexingStatus,
          sjr: article.sjr,
          hIndex: article.hIndex,
          publisher: article.publisher,
          issn: article.issn,
          matchConfidence: article.matchConfidence,
          source: article.source,
          sourceUrl: article.sourceUrl,
          pubmedUrl: article.pubmedUrl,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Save failed.");
      setMessage("تم حفظ المصدر في My Library.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "فشل حفظ المصدر.");
    } finally {
      setSaving((current) => ({ ...current, [key]: false }));
    }
  }

  async function summarize(article: Article, index: number) {
    const key = articleKey(article, index);
    try {
      setSummaryLoading((current) => ({ ...current, [key]: true }));
      const response = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: article.title,
          journal: article.journal,
          authors: article.authors,
          pubdate: article.pubdate,
          abstract: article.abstract,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "AI summary failed.");
      setSummaries((current) => ({ ...current, [key]: data as AiSummary }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "فشل التلخيص الذكي.");
    } finally {
      setSummaryLoading((current) => ({ ...current, [key]: false }));
    }
  }

  async function checkPdf(article: Article, index: number) {
    const key = articleKey(article, index);
    if (!article.doi) {
      setMessage("هذا المصدر لا يحتوي DOI يمكن استخدامه لفحص الوصول المفتوح.");
      return;
    }

    try {
      setPdfLoading((current) => ({ ...current, [key]: true }));
      const params = new URLSearchParams({ doi: article.doi });
      const response = await fetch(`/api/pdf-check?${params.toString()}`);
      const data = (await response.json()) as PdfCheckResult;
      setPdfResults((current) => ({ ...current, [key]: data }));
      if (!response.ok) throw new Error(data.error || "PDF check failed.");

      const target = data.pdfUrl || data.landingPageUrl;
      if (target) {
        window.open(target, "_blank", "noopener,noreferrer");
        setMessage(data.pdfUrl ? "تم فتح PDF المتاح قانونياً." : "تم فتح صفحة الوصول المفتوح.");
      } else {
        setMessage(data.message || "لم يُعثر على نسخة وصول مفتوح لهذا DOI.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "فشل فحص الوصول المفتوح.");
    } finally {
      setPdfLoading((current) => ({ ...current, [key]: false }));
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 sm:px-6 sm:py-7" dir="rtl">
      <section className="mx-auto max-w-7xl">
        <header className="sticky top-3 z-30 mb-5 flex items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-xl">
          <Link href="/dashboard" className="flex items-center gap-3 rounded-xl">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-sm font-black text-white">R</div>
            <div>
              <p className="text-sm font-black text-slate-950">ResearchRanker</p>
              <p className="hidden text-xs text-slate-500 sm:block">Evidence-first Results</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/journals" className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 md:inline-flex">تحقق من مجلة</Link>
            <Link href="/search" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white">بحث جديد</Link>
            <UserButton />
          </div>
        </header>

        <section className="rounded-[30px] border border-slate-200 bg-slate-950 p-5 text-white shadow-xl sm:p-7">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-300">Search results</p>
              <h1 className="mt-2 break-words text-2xl font-black sm:text-3xl">{query || "نتائج البحث"}</h1>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                ترتيب النتائج يحافظ على استدعاء المصادر ولا يخفيها فقط لأن الربع غير معروف. Q يظهر كمؤكد في هذه الشاشة فقط عند مطابقة ISSN دقيقة مع Snapshot التصنيف المحلي.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3"><p className="text-xl font-black">{articles.length}</p><p className="mt-1 text-[11px] text-slate-400">نتيجة</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3"><p className="text-xl font-black">{strictQuartileCount}</p><p className="mt-1 text-[11px] text-slate-400">Q بـISSN</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3"><p className="text-xl font-black">{isDoiSearch ? "DOI" : quartilePreference}</p><p className="mt-1 text-[11px] text-slate-400">تفضيل</p></div>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <input
                ref={filterRef}
                value={filterText}
                onChange={(event) => setFilterText(event.target.value)}
                placeholder="فلترة النتائج الحالية بالعنوان، المجلة، المؤلف، DOI أو ISSN"
                className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pe-12 text-sm font-bold text-slate-900 outline-none focus:border-blue-300 focus:bg-white"
              />
              <kbd className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-black text-slate-400 sm:block">/</kbd>
            </div>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className="min-h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">
              <option value="relevance">الأكثر صلة</option>
              <option value="newest">الأحدث</option>
              <option value="quartile">Q المؤكد أولاً</option>
            </select>
            <select value={citationStyle} onChange={(event) => setCitationStyle(event.target.value as CitationStyle)} className="min-h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">
              <option value="IEEE">IEEE</option>
              <option value="Vancouver">Vancouver</option>
              <option value="APA">APA</option>
            </select>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-1.5">التخصص: {field}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5">تفضيل الربع: {isDoiSearch ? "All - DOI" : quartilePreference}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5">المعروض: {displayedArticles.length}</span>
          </div>
        </section>

        {message ? (
          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold leading-7 text-blue-900">{message}</div>
        ) : null}

        {loading ? (
          <div className="mt-5 space-y-4">
            {[0, 1, 2].map((item) => <div key={item} className="h-64 animate-pulse rounded-[28px] bg-slate-200" />)}
          </div>
        ) : displayedArticles.length === 0 ? (
          <section className="mt-5 rounded-[28px] border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-black text-slate-950">لا توجد نتائج مع الفلترة الحالية</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">امسح فلتر النتائج أو ارجع إلى البحث واستخدم كلمات علمية أكثر تحديداً.</p>
            <button type="button" onClick={() => setFilterText("")} className="mt-4 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white">إلغاء فلترة النتائج</button>
          </section>
        ) : (
          <div className="mt-5 space-y-4">
            {displayedArticles.map((article, index) => {
              const key = articleKey(article, index);
              const q = safeQuartile(article);
              const sourceLink = cleanText(article.sourceUrl) || doiUrl(cleanText(article.doi)) || cleanText(article.pubmedUrl);
              const journalParams = new URLSearchParams();
              if (article.issn) journalParams.set("issn", article.issn.split(",")[0].trim());
              if (article.journal) journalParams.set("title", article.journal);
              const summary = summaries[key];
              const pdf = pdfResults[key];

              return (
                <article key={key} className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md">
                  <div className="p-5 sm:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-wide text-slate-400">
                          <span>{cleanText(article.source) || "Academic metadata"}</span>
                          {article.pubdate ? <span>• {cleanText(article.pubdate)}</span> : null}
                          {article.doi ? <span className="normal-case">• DOI {cleanText(article.doi)}</span> : null}
                        </div>
                        <h2 className="mt-3 text-xl font-black leading-8 text-slate-950 sm:text-2xl">{cleanText(article.title) || "Untitled article"}</h2>
                        <p className="mt-2 text-sm leading-7 text-slate-600">{cleanText(article.authors) || "Authors unavailable"}</p>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1.5 text-xs font-black ${quartileClass(q)}`}>{q ? `${q} • Snapshot` : "Q غير مؤكد"}</span>
                        {quartilePreference !== "All" && q === quartilePreference ? <span className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-black text-white">مطابق للتفضيل</span> : null}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[11px] font-black text-slate-400">المجلة</p><p className="mt-1 text-sm font-black text-slate-900">{cleanText(article.journal) || "غير متاحة"}</p></div>
                      <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[11px] font-black text-slate-400">ISSN</p><p className="mt-1 text-sm font-black text-slate-900">{cleanText(article.issn) || "غير متاح"}</p></div>
                      <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[11px] font-black text-slate-400">الناشر</p><p className="mt-1 text-sm font-black text-slate-900">{cleanText(article.publisher) || "غير متاح"}</p></div>
                      <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[11px] font-black text-slate-400">SJR / H-index</p><p className="mt-1 text-sm font-black text-slate-900">{cleanText(article.sjr) || "—"} / {cleanText(article.hIndex) || "—"}</p></div>
                    </div>

                    <div className={`mt-4 rounded-2xl border p-4 text-xs leading-6 ${q ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                      <strong>{q ? "دليل التصنيف: " : "حالة التصنيف: "}</strong>{verificationText(article)}
                    </div>

                    {article.abstract ? (
                      <details className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                        <summary className="cursor-pointer text-sm font-black text-slate-800">عرض الملخص الأصلي المتاح</summary>
                        <p className="mt-3 text-sm leading-8 text-slate-600">{cleanText(article.abstract)}</p>
                      </details>
                    ) : null}

                    <div className="mt-5 flex flex-wrap gap-2">
                      {sourceLink ? <a href={sourceLink} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white">فتح المصدر</a> : null}
                      <button type="button" onClick={() => copyCitation(article, index)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700">نسخ {citationStyle}</button>
                      <button type="button" onClick={() => summarize(article, index)} disabled={summaryLoading[key]} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-black text-blue-800 disabled:opacity-50">{summaryLoading[key] ? "يفحص الأدلة..." : "تلخيص مقيد بالأدلة"}</button>
                      <button type="button" onClick={() => saveArticle(article, index)} disabled={saving[key]} className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-black text-violet-800 disabled:opacity-50">{saving[key] ? "يحفظ..." : "حفظ في المكتبة"}</button>
                      <button type="button" onClick={() => checkPdf(article, index)} disabled={pdfLoading[key] || !article.doi} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-black text-emerald-800 disabled:opacity-50">{pdfLoading[key] ? "يفحص..." : "Open Access / PDF"}</button>
                      {(article.issn || article.journal) ? <Link href={`/journals?${journalParams.toString()}`} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-black text-slate-700">تحقق من المجلة</Link> : null}
                    </div>

                    {pdf ? (
                      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs leading-6 text-emerald-900">
                        {pdf.pdfUrl ? "توجد وصلة PDF وصول مفتوح في البيانات المتاحة." : pdf.landingPageUrl ? "توجد صفحة وصول مفتوح، لكن رابط PDF المباشر غير متاح في الاستجابة." : pdf.message || "لم يُعثر على وصول مفتوح."}
                      </div>
                    ) : null}

                    {summary ? (
                      <section className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-black text-blue-950">AI Evidence Summary</h3>
                          <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-blue-700">Basis: {summary.evidenceBasis || "abstract"}</span>
                        </div>
                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                          <div><p className="text-xs font-black text-blue-700">Objective</p><p className="mt-1 text-sm leading-7 text-slate-700">{summary.objective}</p></div>
                          <div><p className="text-xs font-black text-blue-700">Methodology</p><p className="mt-1 text-sm leading-7 text-slate-700">{summary.methodology}</p></div>
                          <div><p className="text-xs font-black text-blue-700">Findings</p><ul className="mt-1 space-y-1 text-sm leading-7 text-slate-700">{(summary.keyFindings || []).map((finding) => <li key={finding}>• {finding}</li>)}</ul></div>
                          <div><p className="text-xs font-black text-blue-700">Conclusion</p><p className="mt-1 text-sm leading-7 text-slate-700">{summary.conclusion}</p></div>
                        </div>
                        <div className="mt-4 rounded-xl bg-white/70 p-4">
                          <p className="text-xs font-black text-slate-500">Evidence notes</p>
                          <ul className="mt-2 space-y-1 text-xs leading-6 text-slate-600">{(summary.evidenceNotes || []).map((note) => <li key={note}>• {note}</li>)}</ul>
                          <p className="mt-3 text-xs font-bold leading-6 text-amber-800">{summary.limitationNote}</p>
                        </div>
                      </section>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
