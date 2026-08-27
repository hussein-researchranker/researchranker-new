"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

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
function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function getInitialParam(name: string, fallback = "") {
  if (typeof window === "undefined") return fallback;
  return new URLSearchParams(window.location.search).get(name) || fallback;
}

function extractYear(value: string) {
  const match = cleanText(value).match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : "n.d.";
}

function doiUrl(doi: string) {
  const cleanDoi = cleanText(doi);
  return cleanDoi ? `https://doi.org/${cleanDoi}` : "";
}

function formatCitation(article: Article, style: CitationStyle, index: number) {
  const authors = cleanText(article.authors) || "Unknown author";
  const title = cleanText(article.title) || "Untitled article";
  const journal = cleanText(article.journal) || "Unknown journal";
  const pubdate = cleanText(article.pubdate) || "n.d.";
  const year = extractYear(pubdate);
  const doi = cleanText(article.doi);

  if (style === "Vancouver") {
    return `${index}. ${authors}. ${title}. ${journal}. ${pubdate}.${
      doi ? ` doi: ${doi}.` : ""
    }`;
  }

  if (style === "APA") {
    return `${authors}. (${year}). ${title}. ${journal}.${
      doi ? ` ${doiUrl(doi)}` : ""
    }`;
  }

  return `[${index}] ${authors}, "${title}," ${journal}, ${pubdate}.${
    doi ? ` doi: ${doi}.` : ""
  }`;
}

function isVerifiedQuartile(article: Article) {
  const quartile = cleanText(article.quartile);
  const confidence = cleanText(article.matchConfidence).toLowerCase();

  return (
    /^Q[1-4]$/.test(quartile) &&
    (confidence.includes("issn exact match") ||
      confidence.includes("journal title exact match") ||
      confidence.includes("strict token match"))
  );
}

function getQuartileBadgeClass(article: Article) {
  const quartile = cleanText(article.quartile);

  if (!isVerifiedQuartile(article)) {
    return "border-slate-200 bg-slate-100 text-slate-600";
  }

  if (quartile === "Q1") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (quartile === "Q2") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (quartile === "Q3") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (quartile === "Q4") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-slate-200 bg-slate-100 text-slate-600";
}

function getQuartileLabel(article: Article) {
  if (isVerifiedQuartile(article)) {
    return `${article.quartile} - Verified`;
  }

  return "Not found - Check manually";
}

function getVerificationNote(article: Article) {
  if (isVerifiedQuartile(article)) {
    return "Verified through strict SCImago matching.";
  }

  if (article.matchConfidence?.includes("OpenAlex")) {
    return "Source metadata improved by OpenAlex, but SCImago quartile was not safely verified.";
  }

  if (article.matchConfidence?.includes("Crossref")) {
    return "Crossref metadata available, but SCImago quartile was not safely verified.";
  }

  return "Quartile could not be safely verified from the available metadata.";
}

function getArticleSourceLabel(article: Article) {
  const source = cleanText(article.source);

  if (source) return source;

  if (article.pmid) return "PubMed";

  return "Crossref / Global Search";
}

export default function ResultsPage() {
  const [query, setQuery] = useState("");
  const [quartile, setQuartile] = useState("All");
  const [field, setField] = useState("all");
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [citationStyle, setCitationStyle] = useState<CitationStyle>("IEEE");
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [summaryLoading, setSummaryLoading] = useState<Record<string, boolean>>(
    {}
  );
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [pdfLoading, setPdfLoading] = useState<Record<string, boolean>>({});
  const [pdfResults, setPdfResults] = useState<Record<string, PdfCheckResult>>({});

  const isDoiSearch = useMemo(() => /10\.\d{4,9}\//i.test(query), [query]);

  const filteredArticles = useMemo(() => {
    if (quartile === "All" || isDoiSearch) return articles;

    const matched = articles.filter((article) => {
      const articleQuartile = cleanText(article.quartile);
      return articleQuartile === quartile || articleQuartile === "Not found";
    });

    return matched.length > 0 ? matched : articles;
  }, [articles, quartile, isDoiSearch]);

  const showingQuartileFallback = useMemo(() => {
    if (quartile === "All" || isDoiSearch || articles.length === 0) return false;

    return !articles.some((article) => {
      const articleQuartile = cleanText(article.quartile);
      return articleQuartile === quartile || articleQuartile === "Not found";
    });
  }, [articles, quartile, isDoiSearch]);

  const verifiedCount = useMemo(() => {
    return filteredArticles.filter(isVerifiedQuartile).length;
  }, [filteredArticles]);

  useEffect(() => {
    const q = getInitialParam("q", "");
    const selectedQuartile = getInitialParam("quartile", "All");
    const selectedField = getInitialParam("field", "all");

    setQuery(q);
    setQuartile(selectedQuartile);
    setField(selectedField);

    if (!q.trim()) {
      setLoading(false);
      setMessage("لا يوجد موضوع بحث. ارجع إلى صفحة البحث واكتب موضوعاً.");
      return;
    }

    async function loadResults() {
      try {
        setLoading(true);
        setMessage("");

        const params = new URLSearchParams({
          query: q.trim(),
          fromYear: "1990",
          toYear: new Date().getFullYear().toString(),
          maxResults: "50",
          field: selectedField,
        });

        const response = await fetch(`/api/global-search?${params.toString()}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || "Search failed.");
        }

        if (!Array.isArray(data)) {
          throw new Error("Unexpected search response.");
        }

        setArticles(data);
      } catch (error) {
        console.error("Results page search error:", error);
        setMessage(
          error instanceof Error ? error.message : "فشل تحميل نتائج البحث."
        );
      } finally {
        setLoading(false);
      }
    }

    loadResults();
  }, []);

  async function copyCitation(article: Article, index: number) {
    const citation = formatCitation(article, citationStyle, index + 1);

    try {
      await navigator.clipboard.writeText(citation);
      setMessage("تم نسخ الاقتباس.");
    } catch {
      setMessage("تعذر نسخ الاقتباس.");
    }
  }

  async function saveArticle(article: Article) {
    const articleId = article.doi || article.pmid || article.title || "";

    if (!articleId) {
      setMessage("لا يمكن حفظ مصدر بدون DOI أو PMID أو عنوان.");
      return;
    }

    try {
      setSavingIds((current) => ({ ...current, [articleId]: true }));

      const response = await fetch("/api/library/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: article.id || article.doi || article.pmid || article.title,
          pmid: article.pmid,
          title: article.title,
          journal: article.journal,
          pubdate: article.pubdate,
          authors: article.authors,
          doi: article.doi,
          abstract: article.abstract,
          quartile: article.quartile,
          indexingStatus: article.indexingStatus,
          sjr: article.sjr,
          hIndex: article.hIndex,
          publisher: article.publisher,
          issn: article.issn,
          matchConfidence: article.matchConfidence,
          source: article.source || "Crossref",
          sourceUrl: article.sourceUrl || article.pubmedUrl,
          pubmedUrl: article.pubmedUrl || article.sourceUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Save failed.");
      }

      setMessage("تم حفظ المصدر في My Library.");
    } catch (error) {
      console.error("Save result article error:", error);
      setMessage(error instanceof Error ? error.message : "فشل حفظ المصدر.");
    } finally {
      setSavingIds((current) => ({ ...current, [articleId]: false }));
    }
  }

  async function summarizeArticle(article: Article) {
    const articleId = article.doi || article.pmid || article.title || "";

    if (!articleId) return;

    try {
      setSummaryLoading((current) => ({ ...current, [articleId]: true }));

      const response = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: article.title,
          journal: article.journal,
          authors: article.authors,
          pubdate: article.pubdate,
          abstract: article.abstract,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "AI summary failed.");
      }

      const text = [
        `Objective: ${data.objective || ""}`,
        `Methodology: ${data.methodology || ""}`,
        `Key findings: ${(data.keyFindings || []).join(" | ")}`,
        `Conclusion: ${data.conclusion || ""}`,
        `Research value: ${data.researchValue || ""}`,
        `Limitation: ${data.limitationNote || ""}`,
      ].join("\n\n");

      setSummaries((current) => ({ ...current, [articleId]: text }));
    } catch (error) {
      console.error("AI summary error:", error);
      setMessage(error instanceof Error ? error.message : "فشل التلخيص الذكي.");
    } finally {
      setSummaryLoading((current) => ({ ...current, [articleId]: false }));
    }
  }

  async function checkPdfAccess(article: Article) {
    const articleId = article.doi || article.pmid || article.title || "";

    if (!articleId) {
      setMessage("لا يمكن فحص PDF بدون DOI أو معرف واضح.");
      return;
    }

    if (!article.doi) {
      setMessage("لا يمكن فحص الوصول المفتوح لأن هذا المصدر لا يحتوي DOI.");
      return;
    }

    try {
      setPdfLoading((current) => ({ ...current, [articleId]: true }));

      const params = new URLSearchParams({ doi: article.doi });
      const response = await fetch(`/api/pdf-check?${params.toString()}`);
      const data = (await response.json()) as PdfCheckResult;

      setPdfResults((current) => ({ ...current, [articleId]: data }));

      if (!response.ok) {
        throw new Error(data?.error || "PDF check failed.");
      }

      if (data.pdfUrl) {
        window.open(data.pdfUrl, "_blank", "noopener,noreferrer");
        setMessage("تم فتح رابط PDF المفتوح قانونياً.");
        return;
      }

      if (data.landingPageUrl) {
        window.open(data.landingPageUrl, "_blank", "noopener,noreferrer");
        setMessage(data.message || "تم فتح صفحة الوصول المفتوح.");
        return;
      }

      setMessage(data.message || "لا يوجد PDF مفتوح قانونياً لهذا المصدر.");
    } catch (error) {
      console.error("PDF check error:", error);
      setMessage(error instanceof Error ? error.message : "فشل فحص PDF / Open Access.");
    } finally {
      setPdfLoading((current) => ({ ...current, [articleId]: false }));
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8" dir="rtl">
      <section className="mx-auto max-w-6xl">
        <header className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-bold text-blue-700">Search Results</p>
              <h1 className="mt-2 text-3xl font-black text-slate-900">نتائج البحث المباشرة</h1>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                تظهر نتائج البحث مع حالة التحقق من تصنيف المجلة بوضوح لتجنب التصنيف المضلل.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/search" className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700">
                بحث جديد
              </Link>
              <Link href="/dashboard" className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">
                لوحة التحكم
              </Link>
              <UserButton />
            </div>
          </div>
        </header>

        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-xs font-bold text-slate-500">موضوع البحث</p>
              <p className="mt-1 text-sm font-black text-slate-900">{query || "-"}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">الربع</p>
              <p className="mt-1 text-sm font-black text-slate-900">{isDoiSearch ? "All (DOI)" : quartile}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">التخصص</p>
              <p className="mt-1 text-sm font-black text-slate-900">{field}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">نتائج موثقة الربع</p>
              <p className="mt-1 text-sm font-black text-slate-900">{verifiedCount}</p>
            </div>
          </div>
        </section>

        {showingQuartileFallback && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-7 text-amber-800">
            لم نجد نتيجة مطابقة للربع {quartile} ضمن النتائج الحالية، لذلك نعرض النتائج العلمية المرتبطة بالموضوع بدلاً من إخفائها. تحقق من الربع الظاهر لكل مجلة قبل الاعتماد.
          </div>
        )}

        {message && (
          <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-800">{message}</div>
        )}

        <section className="mb-6 flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-sm font-black text-slate-700">نمط الاقتباس:</span>
          {(["IEEE", "Vancouver", "APA"] as CitationStyle[]).map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => setCitationStyle(style)}
              className={`rounded-xl px-4 py-2 text-sm font-bold ${
                citationStyle === style ? "bg-blue-600 text-white" : "border border-slate-300 bg-white text-slate-700"
              }`}
            >
              {style}
            </button>
          ))}
        </section>

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center font-bold text-slate-700 shadow-sm">
            جاري تحميل النتائج...
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center font-bold text-slate-700 shadow-sm">
            لا توجد نتائج لهذا الاستعلام في المصادر المتاحة حالياً.
          </div>
        ) : (
          <div className="space-y-5">
            {filteredArticles.map((article, index) => {
              const articleId = article.doi || article.pmid || article.title || String(index);
              const sourceUrl = article.sourceUrl || article.pubmedUrl || doiUrl(article.doi || "");

              return (
                <article key={`${articleId}-${index}`} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex flex-wrap gap-2">
                        <span className={`rounded-full border px-3 py-1 text-xs font-black ${getQuartileBadgeClass(article)}`}>
                          {getQuartileLabel(article)}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-600">
                          {getArticleSourceLabel(article)}
                        </span>
                      </div>

                      <h2 className="text-xl font-black leading-8 text-slate-900">{article.title || "Untitled article"}</h2>
                      <p className="mt-3 text-sm leading-7 text-slate-600">{getVerificationNote(article)}</p>

                      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                        <p><span className="font-black text-slate-700">المجلة:</span> {article.journal || "-"}</p>
                        <p><span className="font-black text-slate-700">التاريخ:</span> {article.pubdate || "-"}</p>
                        <p><span className="font-black text-slate-700">المؤلفون:</span> {article.authors || "-"}</p>
                        <p><span className="font-black text-slate-700">DOI:</span> {article.doi || "-"}</p>
                        <p><span className="font-black text-slate-700">ISSN:</span> {article.issn || "-"}</p>
                        <p><span className="font-black text-slate-700">الناشر:</span> {article.publisher || "-"}</p>
                        <p><span className="font-black text-slate-700">SJR:</span> {article.sjr || "-"}</p>
                        <p><span className="font-black text-slate-700">H-index:</span> {article.hIndex || "-"}</p>
                      </div>

                      {article.abstract && (
                        <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">{article.abstract}</p>
                      )}

                      {summaries[articleId] && (
                        <pre className="mt-4 whitespace-pre-wrap rounded-2xl border border-purple-200 bg-purple-50 p-4 text-sm leading-7 text-slate-700">{summaries[articleId]}</pre>
                      )}

                      {pdfResults[articleId] && !pdfLoading[articleId] && (
                        <p className="mt-3 text-xs font-bold text-slate-500">{pdfResults[articleId].message || "تم فحص الوصول المفتوح."}</p>
                      )}
                    </div>

                    <div className="flex w-full flex-col gap-2 lg:w-52">
                      {sourceUrl && (
                        <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-bold text-white">
                          فتح المصدر
                        </a>
                      )}
                      <button type="button" onClick={() => copyCitation(article, index)} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700">
                        نسخ الاقتباس
                      </button>
                      <button type="button" onClick={() => summarizeArticle(article)} disabled={summaryLoading[articleId]} className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm font-bold text-purple-700 disabled:opacity-50">
                        {summaryLoading[articleId] ? "جاري التلخيص..." : "AI Summary"}
                      </button>
                      <button type="button" onClick={() => saveArticle(article)} disabled={savingIds[articleId]} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 disabled:opacity-50">
                        {savingIds[articleId] ? "جاري الحفظ..." : "Save to Library"}
                      </button>
                      <button type="button" onClick={() => checkPdfAccess(article)} disabled={pdfLoading[articleId]} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 disabled:opacity-50">
                        {pdfLoading[articleId] ? "جاري الفحص..." : "PDF / Open Access"}
                      </button>
                    </div>
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
