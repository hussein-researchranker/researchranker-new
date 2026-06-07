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
  sourceUrl?: string;
  pubmedUrl?: string;
};

type CitationStyle = "IEEE" | "Vancouver" | "APA";

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function getInitialParam(name: string, fallback = "") {
  if (typeof window === "undefined") return fallback;
  return new URLSearchParams(window.location.search).get(name) || fallback;
}

function formatCitation(article: Article, style: CitationStyle, index: number) {
  const authors = cleanText(article.authors) || "Unknown author";
  const title = cleanText(article.title) || "Untitled article";
  const journal = cleanText(article.journal) || "Unknown journal";
  const year = cleanText(article.pubdate) || "n.d.";
  const doi = cleanText(article.doi);

  if (style === "Vancouver") {
    return `${index}. ${authors}. ${title}. ${journal}. ${year}.${doi ? ` doi: ${doi}` : ""}`;
  }

  if (style === "APA") {
    return `${authors}. (${year}). ${title}. ${journal}.${doi ? ` https://doi.org/${doi}` : ""}`;
  }

  return `[${index}] ${authors}, "${title}," ${journal}, ${year}.${doi ? ` doi: ${doi}` : ""}`;
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
  const [summaryLoading, setSummaryLoading] = useState<Record<string, boolean>>({});
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});

  const filteredArticles = useMemo(() => {
    if (quartile === "All") return articles;
    return articles.filter((article) => cleanText(article.quartile) === quartile);
  }, [articles, quartile]);

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
          toYear: "2026",
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
          error instanceof Error
            ? error.message
            : "فشل تحميل نتائج البحث."
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
    const articleId = article.pmid || article.title || "";

    if (!articleId) {
      setMessage("لا يمكن حفظ مصدر بدون PMID أو عنوان.");
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
          source: "PubMed",
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
      setMessage(
        error instanceof Error ? error.message : "فشل حفظ المصدر."
      );
    } finally {
      setSavingIds((current) => ({ ...current, [articleId]: false }));
    }
  }

  async function summarizeArticle(article: Article) {
    const articleId = article.pmid || article.title || "";

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
      setMessage(
        error instanceof Error ? error.message : "فشل التلخيص الذكي."
      );
    } finally {
      setSummaryLoading((current) => ({ ...current, [articleId]: false }));
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8" dir="rtl">
      <section className="mx-auto max-w-6xl">
        <header className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-bold text-blue-700">Search Results</p>
              <h1 className="mt-2 text-3xl font-black text-slate-900">
                نتائج البحث المباشرة
              </h1>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                النتائج مفلترة حسب الربع المختار والتخصص القادم من صفحة البحث.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/search"
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700"
              >
                بحث جديد
              </Link>
              <Link
                href="/dashboard"
                className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"
              >
                لوحة التحكم
              </Link>
              <UserButton />
            </div>
          </div>
        </header>

        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-500">موضوع البحث</p>
              <p className="mt-1 font-bold text-slate-900">{query || "غير محدد"}</p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-500">الربع</p>
              <p className="mt-1 font-bold text-slate-900">{quartile}</p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-500">التخصص</p>
              <p className="mt-1 font-bold text-slate-900">{field}</p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-500">عدد النتائج</p>
              <p className="mt-1 font-bold text-slate-900">
                {filteredArticles.length}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <label className="text-sm font-bold text-slate-700">
              نمط الاقتباس
            </label>
            <select
              value={citationStyle}
              onChange={(event) =>
                setCitationStyle(event.target.value as CitationStyle)
              }
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700"
            >
              <option value="IEEE">IEEE</option>
              <option value="Vancouver">Vancouver</option>
              <option value="APA">APA</option>
            </select>
          </div>
        </section>

        {message && (
          <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-800">
            {message}
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center font-bold text-slate-700 shadow-sm">
            جاري تحميل النتائج...
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center font-bold text-slate-700 shadow-sm">
            لا توجد نتائج مطابقة لهذا الربع والتخصص.
          </div>
        ) : (
          <div className="space-y-5">
            {filteredArticles.map((article, index) => {
              const articleId = article.pmid || article.title || String(index);
              const sourceUrl =
                article.sourceUrl ||
                article.pubmedUrl ||
                (article.pmid
                  ? `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`
                  : "");

              return (
                <article
                  key={articleId}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                        PubMed {article.pmid ? `• PMID: ${article.pmid}` : ""}
                      </p>
                      <h2 className="mt-2 text-xl font-black leading-8 text-slate-900">
                        {article.title || "Untitled article"}
                      </h2>
                    </div>

                    <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-black text-blue-700">
                      {article.quartile || "Not found"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                    <p>
                      <span className="font-bold text-slate-800">Journal:</span>{" "}
                      {article.journal || "Unknown"}
                    </p>
                    <p>
                      <span className="font-bold text-slate-800">Date:</span>{" "}
                      {article.pubdate || "Unknown"}
                    </p>
                    <p>
                      <span className="font-bold text-slate-800">DOI:</span>{" "}
                      {article.doi || "Not available"}
                    </p>
                    <p>
                      <span className="font-bold text-slate-800">
                        Indexing:
                      </span>{" "}
                      {article.indexingStatus || "Unknown / check manually"}
                    </p>
                  </div>

                  {article.abstract && (
                    <p className="mt-4 line-clamp-4 text-sm leading-7 text-slate-600">
                      {article.abstract}
                    </p>
                  )}

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => copyCitation(article, index)}
                      className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700"
                    >
                      توليد الاقتباس
                    </button>

                    <button
                      type="button"
                      onClick={() => saveArticle(article)}
                      disabled={savingIds[articleId]}
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 disabled:opacity-60"
                    >
                      {savingIds[articleId] ? "جاري الحفظ..." : "حفظ في المكتبة"}
                    </button>

                    <button
                      type="button"
                      onClick={() => summarizeArticle(article)}
                      disabled={summaryLoading[articleId]}
                      className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700 disabled:opacity-60"
                    >
                      {summaryLoading[articleId]
                        ? "جاري التلخيص..."
                        : "التلخيص الذكي ✨"}
                    </button>

                    {sourceUrl ? (
                      <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700"
                      >
                        فتح النص/المصدر
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-400"
                      >
                        PDF غير متاح
                      </button>
                    )}
                  </div>

                  {summaries[articleId] && (
                    <pre className="mt-5 whitespace-pre-wrap rounded-2xl border border-purple-100 bg-purple-50 p-4 text-sm leading-7 text-slate-700">
                      {summaries[articleId]}
                    </pre>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}