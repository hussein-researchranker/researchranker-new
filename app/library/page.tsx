"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import Toast from "@/components/ui/Toast";

type LibraryArticle = {
  id?: string;
  pmid?: string;
  title?: string;
  journal?: string;
  pubdate?: string;
  authors?: string;
  doi?: string;
  abstract?: string;
  source?: string;
  sourceUrl?: string;
  pubmedUrl?: string;
  quartile?: string;
  indexingStatus?: string;
  sjr?: string;
  hIndex?: string;
  publisher?: string;
  issn?: string;
  matchConfidence?: string;
  savedAt?: string;
};

type CitationStyle = "IEEE" | "Vancouver" | "APA";
type SortMode = "newest" | "title" | "year";
type ToastState = {
  message: string;
  tone: "success" | "error" | "info";
};

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function extractYear(value: string) {
  const match = cleanText(value).match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : 0;
}

function doiUrl(doi: string) {
  const value = cleanText(doi);
  return value ? `https://doi.org/${value}` : "";
}

function isVerifiedQuartile(article: LibraryArticle) {
  const quartile = cleanText(article.quartile);
  const confidence = cleanText(article.matchConfidence).toLowerCase();

  return (
    /^Q[1-4]$/.test(quartile) &&
    (confidence.includes("issn exact match") ||
      confidence.includes("journal title exact match") ||
      confidence.includes("strict token match"))
  );
}

function quartileClasses(article: LibraryArticle) {
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

function formatCitation(
  article: LibraryArticle,
  style: CitationStyle,
  index: number
) {
  const authors = cleanText(article.authors) || "Unknown author";
  const title = cleanText(article.title) || "Untitled article";
  const journal = cleanText(article.journal) || "Unknown journal";
  const pubdate = cleanText(article.pubdate) || "n.d.";
  const year = extractYear(pubdate) || "n.d.";
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

function escapeCsv(value: unknown) {
  const text = cleanText(value).replaceAll('"', '""');
  return `"${text}"`;
}

export default function LibraryPage() {
  const [articles, setArticles] = useState<LibraryArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [quartile, setQuartile] = useState("All");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [citationStyle, setCitationStyle] = useState<CitationStyle>("IEEE");
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<ToastState>({ message: "", tone: "info" });

  async function loadLibrary() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/library/list", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "تعذر تحميل المكتبة.");
      }

      setArticles(Array.isArray(data?.articles) ? data.articles : []);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "تعذر تحميل المكتبة.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLibrary();
  }, []);

  const filteredArticles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = articles.filter((article) => {
      const matchesQuery =
        !normalizedQuery ||
        [
          article.title,
          article.authors,
          article.journal,
          article.doi,
          article.pmid,
          article.publisher,
          article.issn,
        ]
          .map((value) => cleanText(value).toLowerCase())
          .some((value) => value.includes(normalizedQuery));

      const matchesQuartile =
        quartile === "All" ||
        (quartile === "Unverified"
          ? !isVerifiedQuartile(article)
          : isVerifiedQuartile(article) && article.quartile === quartile);

      return matchesQuery && matchesQuartile;
    });

    return [...filtered].sort((first, second) => {
      if (sortMode === "title") {
        return cleanText(first.title).localeCompare(cleanText(second.title));
      }

      if (sortMode === "year") {
        return extractYear(cleanText(second.pubdate)) - extractYear(cleanText(first.pubdate));
      }

      const firstTime = Date.parse(first.savedAt || "");
      const secondTime = Date.parse(second.savedAt || "");
      return (Number.isFinite(secondTime) ? secondTime : 0) -
        (Number.isFinite(firstTime) ? firstTime : 0);
    });
  }, [articles, quartile, query, sortMode]);

  const verifiedCount = useMemo(
    () => articles.filter(isVerifiedQuartile).length,
    [articles]
  );

  const uniqueJournals = useMemo(() => {
    return new Set(
      articles.map((article) => cleanText(article.journal)).filter(Boolean)
    ).size;
  }, [articles]);

  async function deleteArticle(article: LibraryArticle) {
    const id = cleanText(article.id || article.pmid || article.title);
    if (!id) return;

    try {
      setDeletingIds((current) => ({ ...current, [id]: true }));

      const response = await fetch("/api/library/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "فشل حذف المصدر.");
      }

      setArticles((current) =>
        current.filter(
          (item) => cleanText(item.id || item.pmid || item.title) !== id
        )
      );
      setToast({ message: "تم حذف المصدر من المكتبة.", tone: "success" });
    } catch (deleteError) {
      setToast({
        message:
          deleteError instanceof Error
            ? deleteError.message
            : "فشل حذف المصدر.",
        tone: "error",
      });
    } finally {
      setDeletingIds((current) => ({ ...current, [id]: false }));
    }
  }

  async function copyCitation(article: LibraryArticle, index: number) {
    try {
      await navigator.clipboard.writeText(
        formatCitation(article, citationStyle, index + 1)
      );
      setToast({ message: "تم نسخ الاقتباس إلى الحافظة.", tone: "success" });
    } catch {
      setToast({ message: "تعذر نسخ الاقتباس.", tone: "error" });
    }
  }

  function exportCsv() {
    if (filteredArticles.length === 0) {
      setToast({ message: "لا توجد مصادر لتصديرها.", tone: "info" });
      return;
    }

    const header = [
      "Title",
      "Authors",
      "Journal",
      "Year/Date",
      "DOI",
      "PMID",
      "Quartile",
      "Indexing",
      "Publisher",
      "ISSN",
      "Saved At",
    ];

    const rows = filteredArticles.map((article) =>
      [
        article.title,
        article.authors,
        article.journal,
        article.pubdate,
        article.doi,
        article.pmid,
        isVerifiedQuartile(article) ? article.quartile : "Unverified",
        article.indexingStatus,
        article.publisher,
        article.issn,
        article.savedAt,
      ]
        .map(escapeCsv)
        .join(",")
    );

    const csv = `\uFEFF${header.map(escapeCsv).join(",")}\n${rows.join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `researchranker-library-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setToast({ message: "تم تصدير المكتبة بصيغة CSV.", tone: "success" });
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb]" dir="rtl">
      <AppHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-l from-blue-50 via-white to-indigo-50 px-6 py-7 sm:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                  Research workspace
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                  مكتبتي البحثية
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                  مكان موحّد لحفظ المصادر، مراجعة بيانات المجلات، نسخ الاقتباسات،
                  والعودة إلى الأوراق المهمة دون إعادة البحث عنها.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={exportCsv}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  تصدير CSV
                </button>
                <Link
                  href="/search"
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
                >
                  إضافة مصادر جديدة
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-px bg-slate-200 sm:grid-cols-3">
            {[
              ["المصادر المحفوظة", articles.length],
              ["تصنيف موثّق", verifiedCount],
              ["مجلات مختلفة", uniqueJournals],
            ].map(([label, value]) => (
              <div key={String(label)} className="bg-white px-6 py-5">
                <p className="text-xs font-bold text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
            <label className="relative block">
              <span className="sr-only">بحث داخل المكتبة</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ابحث بالعنوان، المؤلف، المجلة، DOI أو PMID..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <select
              value={quartile}
              onChange={(event) => setQuartile(event.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700"
              aria-label="تصفية حسب الربع"
            >
              <option value="All">كل التصنيفات</option>
              <option value="Q1">Q1 موثّق</option>
              <option value="Q2">Q2 موثّق</option>
              <option value="Q3">Q3 موثّق</option>
              <option value="Q4">Q4 موثّق</option>
              <option value="Unverified">غير موثّق</option>
            </select>

            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700"
              aria-label="ترتيب المصادر"
            >
              <option value="newest">الأحدث حفظاً</option>
              <option value="year">الأحدث نشراً</option>
              <option value="title">حسب العنوان</option>
            </select>

            <select
              value={citationStyle}
              onChange={(event) =>
                setCitationStyle(event.target.value as CitationStyle)
              }
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700"
              aria-label="نمط الاقتباس"
            >
              <option value="IEEE">IEEE</option>
              <option value="Vancouver">Vancouver</option>
              <option value="APA">APA</option>
            </select>
          </div>
        </section>

        {loading ? (
          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-64 animate-pulse rounded-3xl border border-slate-200 bg-white shadow-sm"
              />
            ))}
          </section>
        ) : error ? (
          <section className="mt-6 rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-xl font-black text-red-700">
              !
            </div>
            <h2 className="mt-4 text-xl font-black text-slate-950">تعذر فتح المكتبة</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">{error}</p>
            <button
              type="button"
              onClick={loadLibrary}
              className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white"
            >
              إعادة المحاولة
            </button>
          </section>
        ) : articles.length === 0 ? (
          <section className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-2xl font-black text-blue-700">
              R
            </div>
            <h2 className="mt-5 text-2xl font-black text-slate-950">مكتبتك جاهزة</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-600">
              لم تحفظ أي مصدر بعد. ابدأ بحثاً، ثم اضغط «حفظ في المكتبة» على أي
              ورقة تريد الرجوع إليها لاحقاً.
            </p>
            <Link
              href="/search"
              className="mt-6 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
            >
              ابدأ البحث الآن
            </Link>
          </section>
        ) : filteredArticles.length === 0 ? (
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-black text-slate-950">لا توجد نتائج مطابقة</h2>
            <p className="mt-2 text-sm text-slate-600">
              غيّر عبارة البحث أو فلتر التصنيف لعرض مصادر أخرى.
            </p>
          </section>
        ) : (
          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            {filteredArticles.map((article, index) => {
              const id = cleanText(article.id || article.pmid || article.title || index);
              const sourceUrl =
                cleanText(article.sourceUrl || article.pubmedUrl) ||
                doiUrl(cleanText(article.doi));

              return (
                <article
                  key={id}
                  className="group flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
                        <span>{cleanText(article.source) || "Scholarly source"}</span>
                        {article.pmid && <span>PMID {article.pmid}</span>}
                      </div>
                      <h2 className="mt-3 text-lg font-black leading-8 text-slate-950 sm:text-xl">
                        {cleanText(article.title) || "Untitled article"}
                      </h2>
                    </div>

                    <span
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-black ${quartileClasses(
                        article
                      )}`}
                    >
                      {isVerifiedQuartile(article)
                        ? `${article.quartile} Verified`
                        : "Unverified"}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
                    <p className="font-semibold text-slate-700">
                      {cleanText(article.authors) || "Authors not available"}
                    </p>
                    <p>
                      <span className="font-bold text-slate-900">Journal:</span>{" "}
                      {cleanText(article.journal) || "Unknown"}
                    </p>
                    <p>
                      <span className="font-bold text-slate-900">Date:</span>{" "}
                      {cleanText(article.pubdate) || "Unknown"}
                    </p>
                    {article.doi && (
                      <p className="break-all">
                        <span className="font-bold text-slate-900">DOI:</span>{" "}
                        {article.doi}
                      </p>
                    )}
                  </div>

                  {article.abstract && (
                    <p className="mt-4 line-clamp-3 text-sm leading-7 text-slate-600">
                      {article.abstract}
                    </p>
                  )}

                  <div className="mt-auto flex flex-wrap gap-2 pt-5">
                    <button
                      type="button"
                      onClick={() => copyCitation(article, index)}
                      className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-black text-blue-700 hover:bg-blue-100"
                    >
                      نسخ الاقتباس
                    </button>

                    {sourceUrl && (
                      <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                      >
                        فتح المصدر
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => deleteArticle(article)}
                      disabled={deletingIds[id]}
                      className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-black text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      {deletingIds[id] ? "جاري الحذف..." : "حذف"}
                    </button>
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
        onClose={() => setToast((current) => ({ ...current, message: "" }))}
      />
    </div>
  );
}
