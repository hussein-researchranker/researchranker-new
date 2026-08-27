"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import Toast from "@/components/ui/Toast";

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
type ToastState = {
  message: string;
  tone: "success" | "error" | "info";
  actionHref?: string;
  actionLabel?: string;
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
  const value = cleanText(doi);
  return value ? `https://doi.org/${value}` : "";
}

function articleKey(article: Article) {
  return cleanText(article.id || article.doi || article.pmid || article.title);
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

function quartileBadgeClass(article: Article) {
  if (!isVerifiedQuartile(article)) {
    return "border-slate-200 bg-slate-100 text-slate-600";
  }

  switch (article.quartile) {
    case "Q1":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Q2":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "Q3":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "Q4":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

function verificationLabel(article: Article) {
  return isVerifiedQuartile(article)
    ? `${article.quartile} • Verified`
    : "Quartile unverified";
}

function verificationNote(article: Article) {
  if (isVerifiedQuartile(article)) {
    return "تم التحقق عبر مطابقة صارمة لبيانات المجلة.";
  }

  if (cleanText(article.matchConfidence).includes("OpenAlex")) {
    return "بيانات وصفية محسّنة من OpenAlex، لكن الربع لم يُثبت بأمان.";
  }

  if (cleanText(article.matchConfidence).includes("Crossref")) {
    return "بيانات Crossref متاحة، لكن الربع لم يُثبت بأمان.";
  }

  return "لم يتمكن النظام من تأكيد الربع بأمان؛ يُنصح بالتحقق اليدوي.";
}

function articleSourceLabel(article: Article) {
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
  const [pageMessage, setPageMessage] = useState("");
  const [citationStyle, setCitationStyle] = useState<CitationStyle>("IEEE");
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [summaryLoading, setSummaryLoading] = useState<Record<string, boolean>>({});
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [pdfLoading, setPdfLoading] = useState<Record<string, boolean>>({});
  const [pdfResults, setPdfResults] = useState<Record<string, PdfCheckResult>>({});
  const [toast, setToast] = useState<ToastState>({ message: "", tone: "info" });

  const filteredArticles = useMemo(() => {
    if (quartile === "All") return articles;

    return articles.filter((article) => {
      if (!isVerifiedQuartile(article)) return true;
      return cleanText(article.quartile) === quartile;
    });
  }, [articles, quartile]);

  const verifiedCount = useMemo(
    () => filteredArticles.filter(isVerifiedQuartile).length,
    [filteredArticles]
  );

  useEffect(() => {
    const q = getInitialParam("q", "");
    const selectedQuartile = getInitialParam("quartile", "All");
    const selectedField = getInitialParam("field", "all");

    setQuery(q);
    setQuartile(selectedQuartile);
    setField(selectedField);

    if (!q.trim()) {
      setLoading(false);
      setPageMessage("لا يوجد موضوع بحث. ارجع إلى صفحة البحث واكتب موضوعاً.");
      return;
    }

    async function loadResults() {
      try {
        setLoading(true);
        setPageMessage("");

        const params = new URLSearchParams({
          query: q.trim(),
          fromYear: "1990",
          toYear: "2026",
          maxResults: "50",
          field: selectedField,
        });

        const response = await fetch(`/api/global-search?${params.toString()}`);
        const data = await response.json();

        if (!response.ok) throw new Error(data?.error || "Search failed.");
        if (!Array.isArray(data)) throw new Error("Unexpected search response.");

        setArticles(data);
      } catch (error) {
        console.error("Results page search error:", error);
        setPageMessage(
          error instanceof Error ? error.message : "فشل تحميل نتائج البحث."
        );
      } finally {
        setLoading(false);
      }
    }

    async function loadSavedState() {
      try {
        const response = await fetch("/api/library/list", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        const libraryArticles = Array.isArray(data?.articles) ? data.articles : [];
        setSavedIds(
          new Set(
            libraryArticles
              .map((article: Article) => articleKey(article))
              .filter(Boolean)
          )
        );
      } catch {
        // Saving still works; the current saved-state indicator is optional.
      }
    }

    loadResults();
    loadSavedState();
  }, []);

  async function copyCitation(article: Article, index: number) {
    try {
      await navigator.clipboard.writeText(
        formatCitation(article, citationStyle, index + 1)
      );
      setToast({ message: "تم نسخ الاقتباس إلى الحافظة.", tone: "success" });
    } catch {
      setToast({ message: "تعذر نسخ الاقتباس.", tone: "error" });
    }
  }

  async function saveArticle(article: Article) {
    const id = articleKey(article);

    if (!id) {
      setToast({
        message: "لا يمكن حفظ مصدر بدون DOI أو PMID أو عنوان.",
        tone: "error",
      });
      return;
    }

    if (savedIds.has(id)) {
      setToast({
        message: "هذا المصدر محفوظ بالفعل في مكتبتك.",
        tone: "info",
        actionHref: "/library",
        actionLabel: "فتح المكتبة",
      });
      return;
    }

    try {
      setSavingIds((current) => ({ ...current, [id]: true }));

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
      if (!response.ok) throw new Error(data?.error || "Save failed.");

      setSavedIds((current) => new Set([...current, id]));
      setToast({
        message: "تم حفظ المصدر بنجاح في مكتبتك.",
        tone: "success",
        actionHref: "/library",
        actionLabel: "عرض المكتبة",
      });
    } catch (error) {
      console.error("Save result article error:", error);
      setToast({
        message: error instanceof Error ? error.message : "فشل حفظ المصدر.",
        tone: "error",
      });
    } finally {
      setSavingIds((current) => ({ ...current, [id]: false }));
    }
  }

  async function summarizeArticle(article: Article) {
    const id = articleKey(article);
    if (!id) return;

    try {
      setSummaryLoading((current) => ({ ...current, [id]: true }));

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

      const text = [
        `Objective: ${data.objective || ""}`,
        `Methodology: ${data.methodology || ""}`,
        `Key findings: ${(data.keyFindings || []).join(" | ")}`,
        `Conclusion: ${data.conclusion || ""}`,
        `Research value: ${data.researchValue || ""}`,
        `Limitation: ${data.limitationNote || ""}`,
      ].join("\n\n");

      setSummaries((current) => ({ ...current, [id]: text }));
    } catch (error) {
      console.error("AI summary error:", error);
      setToast({
        message: error instanceof Error ? error.message : "فشل التلخيص الذكي.",
        tone: "error",
      });
    } finally {
      setSummaryLoading((current) => ({ ...current, [id]: false }));
    }
  }

  async function checkPdfAccess(article: Article) {
    const id = articleKey(article);

    if (!id || !article.doi) {
      setToast({
        message: "فحص الوصول المفتوح يحتاج DOI واضحاً لهذا المصدر.",
        tone: "info",
      });
      return;
    }

    try {
      setPdfLoading((current) => ({ ...current, [id]: true }));
      const params = new URLSearchParams({ doi: article.doi });
      const response = await fetch(`/api/pdf-check?${params.toString()}`);
      const data = (await response.json()) as PdfCheckResult;
      setPdfResults((current) => ({ ...current, [id]: data }));

      if (!response.ok) throw new Error(data?.error || "PDF check failed.");

      if (data.pdfUrl) {
        window.open(data.pdfUrl, "_blank", "noopener,noreferrer");
        setToast({ message: "تم فتح نسخة PDF المتاحة قانونياً.", tone: "success" });
        return;
      }

      if (data.landingPageUrl) {
        window.open(data.landingPageUrl, "_blank", "noopener,noreferrer");
        setToast({
          message: data.message || "تم فتح صفحة الوصول المفتوح.",
          tone: "info",
        });
        return;
      }

      setToast({
        message: data.message || "لا توجد نسخة مفتوحة متاحة حالياً.",
        tone: "info",
      });
    } catch (error) {
      console.error("PDF check error:", error);
      setToast({
        message: error instanceof Error ? error.message : "فشل فحص PDF.",
        tone: "error",
      });
    } finally {
      setPdfLoading((current) => ({ ...current, [id]: false }));
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb]" dir="rtl">
      <AppHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-l from-blue-50 via-white to-indigo-50 px-6 py-7 sm:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                  Evidence search
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                  نتائج البحث العلمي
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                  نتائج مباشرة مع فصل واضح بين بيانات المصدر، حالة تصنيف المجلة،
                  الوصول المفتوح، وأدوات الحفظ والتلخيص.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/library"
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  مكتبتي
                </Link>
                <Link
                  href="/search"
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-blue-700"
                >
                  بحث جديد
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["موضوع البحث", query || "غير محدد"],
              ["الربع المستهدف", quartile],
              ["التخصص", field],
              ["النتائج المعروضة", filteredArticles.length],
              ["تصنيف موثّق", verifiedCount],
            ].map(([label, value]) => (
              <div key={String(label)} className="min-w-0 bg-white px-5 py-4">
                <p className="text-[11px] font-bold text-slate-500">{label}</p>
                <p className="mt-1 truncate text-sm font-black text-slate-950">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold leading-6 text-amber-900 sm:text-sm">
            <strong>تنبيه منهجي:</strong> النتائج غير الموثقة تبقى ظاهرة حتى لا
            نخفي ورقة محتملة الصلة، لكنها لا تُحسب ضمن الربع المستهدف إلا بعد
            مطابقة موثوقة.
          </p>
          <select
            value={citationStyle}
            onChange={(event) =>
              setCitationStyle(event.target.value as CitationStyle)
            }
            className="shrink-0 rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-xs font-black text-slate-700"
            aria-label="نمط الاقتباس"
          >
            <option value="IEEE">IEEE citation</option>
            <option value="Vancouver">Vancouver</option>
            <option value="APA">APA</option>
          </select>
        </section>

        {pageMessage && (
          <section className="mt-5 rounded-2xl border border-red-200 bg-white p-5 text-sm font-bold text-red-700 shadow-sm">
            {pageMessage}
          </section>
        )}

        {loading ? (
          <section className="mt-6 space-y-4">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-72 animate-pulse rounded-3xl border border-slate-200 bg-white shadow-sm"
              />
            ))}
          </section>
        ) : filteredArticles.length === 0 ? (
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <h2 className="text-xl font-black text-slate-950">لا توجد نتائج مطابقة</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              جرّب كلمات مفتاحية أوسع أو عدّل الربع والتخصص من صفحة البحث.
            </p>
            <Link
              href="/search"
              className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white"
            >
              تعديل البحث
            </Link>
          </section>
        ) : (
          <section className="mt-6 space-y-4">
            {filteredArticles.map((article, index) => {
              const id = articleKey(article) || String(index);
              const saved = savedIds.has(id);
              const sourceUrl =
                cleanText(article.sourceUrl || article.pubmedUrl) ||
                (article.pmid
                  ? `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`
                  : doiUrl(cleanText(article.doi)));

              return (
                <article
                  key={id}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-lg"
                >
                  <div className="p-5 sm:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1">
                            {articleSourceLabel(article)}
                          </span>
                          {article.pmid && <span>PMID {article.pmid}</span>}
                          {article.doi && <span className="normal-case">DOI {article.doi}</span>}
                        </div>

                        <h2 className="mt-3 text-xl font-black leading-8 text-slate-950 sm:text-2xl">
                          {cleanText(article.title) || "Untitled article"}
                        </h2>

                        <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
                          {cleanText(article.authors) || "Authors not available"}
                        </p>
                      </div>

                      <div className="shrink-0 lg:w-64">
                        <span
                          className={`inline-flex rounded-full border px-3.5 py-2 text-xs font-black ${quartileBadgeClass(
                            article
                          )}`}
                        >
                          {verificationLabel(article)}
                        </span>
                        <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                          {verificationNote(article)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                      <p><span className="font-black text-slate-900">Journal</span><br />{cleanText(article.journal) || "Unknown"}</p>
                      <p><span className="font-black text-slate-900">Date</span><br />{cleanText(article.pubdate) || "Unknown"}</p>
                      <p><span className="font-black text-slate-900">Indexing</span><br />{cleanText(article.indexingStatus) || "Check manually"}</p>
                      <p><span className="font-black text-slate-900">ISSN</span><br />{cleanText(article.issn) || "Not available"}</p>
                    </div>

                    {article.abstract && (
                      <p className="mt-4 line-clamp-4 text-sm leading-7 text-slate-600">
                        {article.abstract}
                      </p>
                    )}

                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => saveArticle(article)}
                        disabled={savingIds[id] || saved}
                        className={`rounded-xl px-4 py-2.5 text-xs font-black transition ${
                          saved
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "bg-emerald-600 text-white hover:bg-emerald-700"
                        } disabled:opacity-80`}
                      >
                        {savingIds[id]
                          ? "جاري الحفظ..."
                          : saved
                            ? "✓ محفوظ في المكتبة"
                            : "حفظ في المكتبة"}
                      </button>

                      <button
                        type="button"
                        onClick={() => copyCitation(article, index)}
                        className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-black text-blue-700 hover:bg-blue-100"
                      >
                        نسخ الاقتباس
                      </button>

                      <button
                        type="button"
                        onClick={() => summarizeArticle(article)}
                        disabled={summaryLoading[id]}
                        className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-xs font-black text-violet-700 hover:bg-violet-100 disabled:opacity-60"
                      >
                        {summaryLoading[id] ? "جاري التلخيص..." : "تلخيص ذكي"}
                      </button>

                      <button
                        type="button"
                        onClick={() => checkPdfAccess(article)}
                        disabled={pdfLoading[id] || !article.doi}
                        className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-xs font-black text-orange-700 hover:bg-orange-100 disabled:opacity-50"
                      >
                        {pdfLoading[id] ? "جاري الفحص..." : "PDF / Open Access"}
                      </button>

                      {sourceUrl && (
                        <a
                          href={sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50"
                        >
                          فتح المصدر
                        </a>
                      )}
                    </div>

                    {pdfResults[id] && (
                      <div className="mt-4 rounded-2xl border border-orange-100 bg-orange-50 p-4 text-xs leading-6 text-orange-900">
                        <p className="font-black">Open Access status</p>
                        <p className="mt-1">{pdfResults[id].message || "No message returned."}</p>
                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-orange-800">
                          <span><strong>OA:</strong> {pdfResults[id].oaStatus || "Unknown"}</span>
                          <span><strong>License:</strong> {pdfResults[id].license || "N/A"}</span>
                          <span><strong>Version:</strong> {pdfResults[id].version || "N/A"}</span>
                        </div>
                      </div>
                    )}

                    {summaries[id] && (
                      <pre className="mt-4 whitespace-pre-wrap rounded-2xl border border-violet-100 bg-violet-50 p-4 text-xs leading-7 text-slate-700 sm:text-sm">
                        {summaries[id]}
                      </pre>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>

      <Toast
        message={toast.message}
        tone={toast.tone}
        actionHref={toast.actionHref}
        actionLabel={toast.actionLabel}
        onClose={() => setToast((current) => ({ ...current, message: "" }))}
      />
    </div>
  );
}
