"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { LibraryArticle } from "@/lib/research-types";

type TrustData = {
  retracted: boolean | null;
  correctionRelations?: string[];
  updateNotices?: Array<{ type: string; label: string; doi: string; source: string }>;
  warnings?: string[];
  evidence?: Array<{ label: string; source: string; url: string }>;
  checkedAt?: string;
};

type PdfData = {
  available?: boolean;
  pdfUrl?: string;
  landingPageUrl?: string;
  isOpenAccess?: boolean;
  license?: string;
  message?: string;
};

type Summary = {
  objective?: string;
  methodology?: string;
  keyFindings?: string[];
  conclusion?: string;
  researchValue?: string;
  limitationNote?: string;
};

type CitationStyle = "IEEE" | "Vancouver" | "APA";

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function keyOf(article: LibraryArticle) {
  return clean(article.id || article.doi || article.pmid || article.title);
}

function yearOf(value?: string) {
  return clean(value).match(/\b(19|20)\d{2}\b/)?.[0] || "n.d.";
}

function formatCitation(article: LibraryArticle, style: CitationStyle) {
  const authors = clean(article.authors) || "Unknown author";
  const title = clean(article.title) || "Untitled article";
  const journal = clean(article.journal) || "Unknown journal";
  const date = clean(article.pubdate) || "n.d.";
  const year = yearOf(article.pubdate);
  const doi = clean(article.doi);

  if (style === "APA") {
    return `${authors}. (${year}). ${title}. ${journal}.${doi ? ` https://doi.org/${doi}` : ""}`;
  }
  if (style === "Vancouver") {
    return `${authors}. ${title}. ${journal}. ${date}.${doi ? ` doi:${doi}.` : ""}`;
  }
  return `${authors}, “${title},” ${journal}, ${date}.${doi ? ` doi: ${doi}.` : ""}`;
}

export default function ArticlePage() {
  const { isArabic } = useLocale();
  const [article, setArticle] = useState<LibraryArticle | null>(null);
  const [related, setRelated] = useState<LibraryArticle[]>([]);
  const [trust, setTrust] = useState<TrustData | null>(null);
  const [pdf, setPdf] = useState<PdfData | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [citationStyle, setCitationStyle] = useState<CitationStyle>("IEEE");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const params = new URLSearchParams(window.location.search);
        const doi = clean(params.get("doi"));
        const id = clean(params.get("id"));
        let found: LibraryArticle | null = null;

        const libraryResponse = await fetch("/api/library/list", { cache: "no-store" });
        if (libraryResponse.ok) {
          const data = await libraryResponse.json();
          const items: LibraryArticle[] = Array.isArray(data?.articles) ? data.articles : [];
          found =
            items.find(
              (item) =>
                (id && keyOf(item) === id) ||
                (doi && clean(item.doi).toLowerCase() === doi.toLowerCase())
            ) || null;
        }

        if (!found && doi) {
          const response = await fetch(
            `/api/global-search?query=${encodeURIComponent(doi)}&fromYear=1990&toYear=${new Date().getFullYear()}&maxResults=10&field=all`,
            { cache: "no-store" }
          );
          const data = await response.json();
          if (response.ok && Array.isArray(data)) {
            found =
              data.find(
                (item: LibraryArticle) =>
                  clean(item.doi).toLowerCase() === doi.toLowerCase()
              ) ||
              data[0] ||
              null;
          }
        }

        if (!found) {
          setMessage(
            isArabic
              ? "تعذر العثور على بيانات هذه الورقة. افتحها من نتائج البحث أو المكتبة."
              : "The paper could not be resolved. Open it from search results or your library."
          );
          return;
        }

        setArticle(found);
        const tasks: Promise<void>[] = [];

        if (found.doi) {
          tasks.push(
            fetch(`/api/trust?doi=${encodeURIComponent(found.doi)}`, { cache: "no-store" }).then(
              async (response) => {
                if (response.ok) setTrust(await response.json());
              }
            )
          );
          tasks.push(
            fetch(`/api/pdf-check?doi=${encodeURIComponent(found.doi)}`, {
              cache: "no-store",
            }).then(async (response) => {
              if (response.ok) setPdf(await response.json());
            })
          );
        }

        if (found.title) {
          const words = clean(found.title).split(" ").slice(0, 8).join(" ");
          tasks.push(
            fetch(
              `/api/global-search?query=${encodeURIComponent(words)}&fromYear=1990&toYear=${new Date().getFullYear()}&maxResults=12&field=all`,
              { cache: "no-store" }
            ).then(async (response) => {
              if (!response.ok) return;
              const data = await response.json();
              if (Array.isArray(data)) {
                setRelated(
                  data
                    .filter(
                      (item: LibraryArticle) =>
                        clean(item.doi) !== clean(found?.doi) &&
                        clean(item.title) !== clean(found?.title)
                    )
                    .slice(0, 6)
                );
              }
            })
          );
        }

        await Promise.all(tasks);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : isArabic
              ? "فشل تحميل الورقة."
              : "Failed to load the paper."
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [isArabic]);

  const sourceLinks = useMemo(() => {
    if (!article) return [] as Array<{ label: string; href: string }>;
    const links: Array<{ label: string; href: string }> = [];
    if (article.doi) links.push({ label: "DOI", href: `https://doi.org/${article.doi}` });
    if (article.pubmedUrl) {
      links.push({ label: clean(article.source) || "Source", href: article.pubmedUrl });
    }
    return links;
  }, [article]);

  const citation = useMemo(
    () => (article ? formatCitation(article, citationStyle) : ""),
    [article, citationStyle]
  );

  async function copyCitation() {
    if (!citation) return;
    try {
      await navigator.clipboard.writeText(citation);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setMessage(isArabic ? "تعذر نسخ الاقتباس." : "Could not copy the citation.");
    }
  }

  async function summarize() {
    if (!article) return;
    setMessage(
      isArabic
        ? "جاري إنشاء ملخص مقيد ببيانات العنوان والملخص..."
        : "Generating a summary constrained to the title and abstract..."
    );
    const response = await fetch("/api/ai/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(article),
    });
    const data = await response.json();
    if (response.ok) {
      setSummary(data);
      setMessage("");
    } else {
      setMessage(
        data?.error || (isArabic ? "تعذر إنشاء الملخص." : "Could not generate the summary.")
      );
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f8fb]" dir={isArabic ? "rtl" : "ltr"}>
        <AppHeader />
        <main className="mx-auto max-w-7xl p-8">
          <div className="h-96 animate-pulse rounded-3xl bg-white" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb]" dir={isArabic ? "rtl" : "ltr"}>
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {!article ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center font-bold text-amber-900">
            {message}
          </div>
        ) : (
          <>
            <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
              <div className="bg-slate-950 p-7 text-white sm:p-10">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-black">
                  <span className="rounded-full bg-white/10 px-3 py-1.5">
                    {isArabic ? "تفاصيل الورقة" : "Article Detail"}
                  </span>
                  {article.quartile ? (
                    <span className="rounded-full bg-blue-500/20 px-3 py-1.5 text-blue-100">
                      {article.quartile}
                    </span>
                  ) : null}
                  {trust?.retracted ? (
                    <span className="rounded-full bg-red-500 px-3 py-1.5">
                      {isArabic ? "تحذير: سحب الورقة" : "RETRACTION WARNING"}
                    </span>
                  ) : null}
                </div>
                <h1 className="mt-5 max-w-5xl text-3xl font-black leading-tight sm:text-4xl">
                  {article.title}
                </h1>
                <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-300">
                  {article.authors}
                </p>
                <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-slate-200">
                  <span>{article.journal}</span>
                  <span>•</span>
                  <span>{article.pubdate}</span>
                  {article.doi ? (
                    <>
                      <span>•</span>
                      <span>DOI {article.doi}</span>
                    </>
                  ) : null}
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  {sourceLinks.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl bg-white px-4 py-2.5 text-xs font-black text-slate-950"
                    >
                      {link.label}
                    </a>
                  ))}
                  {pdf?.pdfUrl ? (
                    <a
                      href={pdf.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-black text-white"
                    >
                      {isArabic ? "فتح PDF" : "Open PDF"}
                    </a>
                  ) : null}
                  {article.doi ? (
                    <Link
                      href={`/graph?doi=${encodeURIComponent(article.doi)}`}
                      className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-black"
                    >
                      {isArabic ? "خريطة العلاقات" : "Relationship Graph"}
                    </Link>
                  ) : null}
                </div>
              </div>
              <div className="grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-5">
                <Metric label="SJR" value={article.sjr || "—"} />
                <Metric label="H-index" value={article.hIndex || "—"} />
                <Metric label="ISSN" value={article.issn || "—"} />
                <Metric
                  label={isArabic ? "الفهرسة" : "Indexing"}
                  value={article.indexingStatus || (isArabic ? "غير معروف" : "Unknown")}
                />
                <Metric
                  label="OA/PDF"
                  value={
                    pdf?.isOpenAccess
                      ? isArabic
                        ? "وصول مفتوح"
                        : "Open access"
                      : pdf?.available
                        ? isArabic
                          ? "PDF متاح"
                          : "PDF found"
                        : isArabic
                          ? "غير موثق"
                          : "Not verified"
                  }
                />
              </div>
            </section>

            {trust ? (
              <section
                className={`mt-6 rounded-3xl border p-5 ${
                  trust.retracted ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                      {isArabic ? "طبقة الثقة" : "Trust Layer"}
                    </p>
                    <h2 className="mt-1 text-xl font-black text-slate-950">
                      {isArabic ? "التحقق من حالة الورقة" : "Post-publication status checks"}
                    </h2>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-black ${
                      trust.retracted
                        ? "bg-red-600 text-white"
                        : trust.retracted === false
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    {trust.retracted
                      ? isArabic
                        ? "إشارة سحب"
                        : "Retraction signal"
                      : trust.retracted === false
                        ? isArabic
                          ? "لا توجد إشارة سحب آلية"
                          : "No automated retraction flag"
                        : isArabic
                          ? "غير حاسم"
                          : "Inconclusive"}
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  {trust.warnings?.map((warning) => (
                    <p key={warning} className="text-xs leading-6 text-slate-700">
                      • {warning}
                    </p>
                  ))}
                </div>
                {trust.updateNotices?.length ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs font-black text-amber-900">
                      {isArabic ? "تحديثات ما بعد النشر" : "Post-publication updates"}
                    </p>
                    {trust.updateNotices.map((update, index) => (
                      <p key={`${update.doi}-${index}`} className="mt-2 text-xs text-amber-900">
                        {update.label || update.type} {update.doi ? `• ${update.doi}` : ""}
                      </p>
                    ))}
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {trust.evidence?.map((item) => (
                    <a
                      key={item.url}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold"
                    >
                      {item.source}: {item.label}
                    </a>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-blue-700">
                      {isArabic ? "الملخص" : "Abstract"}
                    </p>
                    <h2 className="mt-1 text-xl font-black">
                      {isArabic ? "ملخص الدراسة" : "Study abstract"}
                    </h2>
                  </div>
                  <button
                    onClick={summarize}
                    className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white"
                  >
                    {isArabic ? "تلخيص بالذكاء الاصطناعي" : "AI Summary"}
                  </button>
                </div>
                <p className="mt-5 whitespace-pre-wrap text-sm leading-8 text-slate-700">
                  {article.abstract ||
                    (isArabic
                      ? "الملخص غير متاح من المصدر الحالي."
                      : "The abstract is unavailable from the current source.")}
                </p>
                {message ? (
                  <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-600">
                    {message}
                  </p>
                ) : null}
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wider text-violet-700">
                  {isArabic ? "بيانات الأدلة" : "Evidence metadata"}
                </p>
                <h2 className="mt-1 text-xl font-black">
                  {isArabic ? "مصدر كل معلومة" : "Where each data point came from"}
                </h2>
                <dl className="mt-5 space-y-3 text-sm">
                  <Row label={isArabic ? "مطابقة التصنيف" : "Ranking match"} value={article.matchConfidence || "Unverified"} />
                  <Row label={isArabic ? "مصدر التصنيف" : "Ranking source"} value="SCImago snapshot / strict match" />
                  <Row label={isArabic ? "المصدر الببليوغرافي" : "Bibliographic source"} value={article.source || "PubMed / Crossref / OpenAlex"} />
                  <Row label={isArabic ? "الوصول المفتوح" : "Open access"} value={pdf?.isOpenAccess ? `Verified${pdf.license ? ` • ${pdf.license}` : ""}` : "Not verified"} />
                  <Row label={isArabic ? "فحص السحب/التحديث" : "Retraction/update check"} value="OpenAlex + Crossref update metadata" />
                </dl>
              </section>
            </div>

            <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-indigo-700">
                    {isArabic ? "الاقتباس" : "Citation"}
                  </p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">
                    {isArabic ? "صيغة الاقتباس" : "Formatted reference"}
                  </h2>
                </div>
                <div className="flex gap-2">
                  <select
                    value={citationStyle}
                    onChange={(event) => setCitationStyle(event.target.value as CitationStyle)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-black"
                  >
                    <option value="IEEE">IEEE</option>
                    <option value="Vancouver">Vancouver</option>
                    <option value="APA">APA</option>
                  </select>
                  <button
                    onClick={copyCitation}
                    className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white"
                  >
                    {copied
                      ? isArabic
                        ? "تم النسخ ✓"
                        : "Copied ✓"
                      : isArabic
                        ? "نسخ"
                        : "Copy"}
                  </button>
                </div>
              </div>
              <p dir="ltr" className="mt-4 rounded-2xl bg-slate-50 p-4 text-start text-sm leading-7 text-slate-700">
                {citation}
              </p>
            </section>

            {summary ? (
              <section className="mt-6 rounded-3xl border border-blue-200 bg-blue-50/60 p-6">
                <p className="text-xs font-black uppercase tracking-wider text-blue-700">
                  {isArabic ? "ملخص AI مقيد بالملخص الأصلي" : "AI Summary • abstract-grounded"}
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <SummaryBlock label={isArabic ? "الهدف" : "Objective"} text={summary.objective} />
                  <SummaryBlock label={isArabic ? "المنهجية" : "Methodology"} text={summary.methodology} />
                  <SummaryBlock label={isArabic ? "الاستنتاج" : "Conclusion"} text={summary.conclusion} />
                  <SummaryBlock label={isArabic ? "القيمة البحثية" : "Research value"} text={summary.researchValue} />
                </div>
                <div className="mt-4 rounded-2xl bg-white p-4">
                  <h3 className="text-sm font-black">{isArabic ? "النتائج الرئيسية" : "Key findings"}</h3>
                  <ul className="mt-2 space-y-2 text-sm leading-7 text-slate-700">
                    {summary.keyFindings?.map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                </div>
                <p className="mt-4 text-xs font-semibold text-blue-900">{summary.limitationNote}</p>
              </section>
            ) : null}

            <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                    {isArabic ? "أدلة ذات صلة" : "Related evidence"}
                  </p>
                  <h2 className="mt-1 text-xl font-black">
                    {isArabic ? "أوراق ذات صلة" : "Related papers"}
                  </h2>
                </div>
                {article.doi ? (
                  <Link
                    href={`/graph?doi=${encodeURIComponent(article.doi)}`}
                    className="text-xs font-black text-blue-700"
                  >
                    {isArabic ? "فتح الخريطة ←" : "Open graph →"}
                  </Link>
                ) : null}
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {related.map((item) => (
                  <Link
                    key={keyOf(item)}
                    href={`/article?doi=${encodeURIComponent(clean(item.doi))}`}
                    className="rounded-2xl border border-slate-200 p-4 hover:border-blue-300 hover:shadow-sm"
                  >
                    <p className="text-[10px] font-black text-blue-700">
                      {item.journal} • {item.pubdate}
                    </p>
                    <h3 className="mt-2 line-clamp-3 text-sm font-black leading-6 text-slate-950">
                      {item.title}
                    </h3>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-5 py-4">
      <p className="text-[10px] font-bold text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
      <dt className="font-bold text-slate-500">{label}</dt>
      <dd className="max-w-[65%] text-start font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function SummaryBlock({ label, text }: { label: string; text?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <h3 className="text-xs font-black uppercase tracking-wider text-blue-700">{label}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-700">{text}</p>
    </div>
  );
}
