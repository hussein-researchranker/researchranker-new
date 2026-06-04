"use client";

import { useEffect, useMemo, useState } from "react";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";

type NewsItem = {
  title: string;
  source: string;
  link: string;
  date: string;
  summary: string;
};

type Article = {
  pmid: string;
  title: string;
  journal: string;
  pubdate: string;
  authors: string;
  doi: string;
  source: string;
  sourceUrl: string;
  quartile: string;
  indexingStatus: string;
  sjr: string;
  hIndex: string;
  publisher: string;
  issn: string;
};

type CitationStyle = "IEEE" | "Vancouver" | "APA";
type QuartileFilter = "All" | "Q1" | "Q2" | "Q3" | "Q4" | "Not found";
type Language = "en" | "ar";

const citationStyles: CitationStyle[] = ["IEEE", "Vancouver", "APA"];
const quartileFilters: QuartileFilter[] = [
  "All",
  "Q1",
  "Q2",
  "Q3",
  "Q4",
  "Not found",
];

const uiText = {
  en: {
    appTitle: "ResearchRanker",
    appSubtitle:
      "Search research articles, classify journal quartiles, check indexing status, export results, and follow scholarly publishing news.",
    createdBy: "Created by Hussein Jawad Kadhim",
    signIn: "Sign in",
    signedIn: "Signed in",
    guestMode: "Guest mode",
    loading: "Loading...",
    newsLabel: "Live Journal & Publishing News",
    newsTitle: "Latest updates before you search",
    newsDescription:
      "Automatically updated news about journals, indexing, publishing ethics, retractions, open access, and research integrity.",
    openNewsApi: "Open News API",
    loadingNews: "Loading live publishing news...",
    noNews: "Live news could not be loaded right now. Please try again later.",
    searchTitle: "Research Search",
    searchDescription: "Search PubMed articles by topic and publication year range.",
    searchPlaceholder:
      "Search topic, example: zonulin inflammation hemodialysis",
    fromYear: "From year",
    toYear: "To year",
    search: "Search",
    searching: "Searching...",
    emptyQuery: "Please enter a search topic first.",
    noResults: "No PubMed results found for this search.",
    searchFailed:
      "Search failed. Please check your connection or try another topic.",
    foundResults: "PubMed result(s) found.",
    citationStyle: "Citation style",
    quartileFilter: "Quartile filter",
    downloadWord: "Download Word",
    copySource: "Copy source",
    openPubMed: "Open in PubMed",
    journal: "Journal",
    date: "Date",
    authors: "Authors",
    doi: "DOI",
    quartile: "Quartile",
    indexingStatus: "Indexing Status",
    publisher: "Publisher",
    issn: "ISSN",
    support: "Support",
    supportDescription:
      "If you experience a search, export, citation, or account problem, contact support.",
    contactSupport: "Contact Support",
    copied: "Source copied in",
    copyFailed: "Could not copy the source",
    noDownloadResults: "No results to download",
    wordDownloaded: "Word file downloaded in",
    language: "Language",
    arabicSearchNote:
      "Arabic search helper is active: common Arabic scientific terms are converted to English before searching PubMed.",
  },
  ar: {
    appTitle: "ResearchRanker",
    appSubtitle:
      "ابحث عن المقالات العلمية، صنّف المجلات حسب الربع، تحقق من حالة الفهرسة، صدّر النتائج، وتابع أخبار النشر العلمي.",
    createdBy: "أنشئ بواسطة Hussein Jawad Kadhim",
    signIn: "تسجيل الدخول",
    signedIn: "تم تسجيل الدخول",
    guestMode: "وضع الزائر",
    loading: "جاري التحميل...",
    newsLabel: "أخبار المجلات والنشر العلمي",
    newsTitle: "آخر التحديثات قبل البحث",
    newsDescription:
      "أخبار محدثة تلقائياً حول المجلات، الفهرسة، أخلاقيات النشر، السحب العلمي، الوصول المفتوح، ونزاهة البحث العلمي.",
    openNewsApi: "فتح API الأخبار",
    loadingNews: "جاري تحميل أخبار النشر العلمي...",
    noNews: "تعذر تحميل الأخبار حالياً. حاول لاحقاً.",
    searchTitle: "البحث العلمي",
    searchDescription: "ابحث في PubMed حسب الموضوع وسنوات النشر.",
    searchPlaceholder:
      "اكتب موضوع البحث، مثال: زانولين التهاب غسيل الكلى",
    fromYear: "من سنة",
    toYear: "إلى سنة",
    search: "بحث",
    searching: "جاري البحث...",
    emptyQuery: "يرجى إدخال موضوع البحث أولاً.",
    noResults: "لم يتم العثور على نتائج في PubMed لهذا البحث.",
    searchFailed: "فشل البحث. تحقق من الاتصال أو جرّب موضوعاً آخر.",
    foundResults: "نتيجة من PubMed تم العثور عليها.",
    citationStyle: "نمط التوثيق",
    quartileFilter: "فلترة حسب الربع",
    downloadWord: "تحميل Word",
    copySource: "نسخ المصدر",
    openPubMed: "فتح في PubMed",
    journal: "المجلة",
    date: "التاريخ",
    authors: "المؤلفون",
    doi: "DOI",
    quartile: "الربع",
    indexingStatus: "حالة الفهرسة",
    publisher: "الناشر",
    issn: "ISSN",
    support: "الدعم",
    supportDescription:
      "إذا واجهت مشكلة في البحث أو التصدير أو التوثيق أو الحساب، تواصل مع الدعم.",
    contactSupport: "مراسلة الدعم",
    copied: "تم نسخ المصدر بنمط",
    copyFailed: "تعذر نسخ المصدر",
    noDownloadResults: "لا توجد نتائج لتحميلها",
    wordDownloaded: "تم تحميل ملف Word بنمط",
    language: "اللغة",
    arabicSearchNote:
      "مساعد البحث العربي مفعّل: يتم تحويل المصطلحات العلمية العربية الشائعة إلى الإنجليزية قبل البحث في PubMed.",
  },
};

const arabicSearchTerms: Record<string, string> = {
  زانولين: "zonulin",
  الزانولين: "zonulin",
  التهاب: "inflammation",
  الالتهاب: "inflammation",
  التهابات: "inflammation",
  "غسيل الكلى": "hemodialysis",
  "الديلزة الدموية": "hemodialysis",
  ديلزة: "dialysis",
  الكلى: "kidney",
  كلى: "kidney",
  كلوي: "renal",
  "الفشل الكلوي": "renal failure",
  "مرض الكلى المزمن": "chronic kidney disease",
  سكري: "diabetes",
  السكري: "diabetes",
  "داء السكري": "diabetes mellitus",
  سرطان: "cancer",
  "سرطان الثدي": "breast cancer",
  كيمياء: "chemistry",
  "الكيمياء الحياتية": "biochemistry",
  فيزياء: "physics",
  حاسوب: "computer science",
  "ذكاء اصطناعي": "artificial intelligence",
  "تعلم عميق": "deep learning",
  رياضيات: "mathematics",
  قانون: "law",
  أحياء: "biology",
  بكتيريا: "bacteria",
  فيتامين: "vitamin",
  "فيتامين د": "vitamin D",
  كالسيوم: "calcium",
  "هرمون جار الدرقية": "parathyroid hormone",
  "الإجهاد التأكسدي": "oxidative stress",
  أكسدة: "oxidative stress",
  "مالوندايالديهايد": "malondialdehyde",
  "انترلوكين 6": "interleukin 6",
  "IL-6": "IL-6",
};

function getQuartileBadgeClass(quartile: string) {
  if (quartile === "Q1") return "bg-green-100 text-green-800 border-green-200";
  if (quartile === "Q2") return "bg-blue-100 text-blue-800 border-blue-200";
  if (quartile === "Q3") return "bg-yellow-100 text-yellow-800 border-yellow-200";
  if (quartile === "Q4") return "bg-red-100 text-red-800 border-red-200";
  return "bg-gray-100 text-gray-800 border-gray-200";
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function hasArabic(text: string) {
  return /[\u0600-\u06FF]/.test(text);
}

function enhanceArabicQuery(query: string) {
  let enhancedQuery = query;

  Object.entries(arabicSearchTerms).forEach(([arabicTerm, englishTerm]) => {
    if (query.includes(arabicTerm) && !enhancedQuery.includes(englishTerm)) {
      enhancedQuery += ` ${englishTerm}`;
    }
  });

  return cleanText(enhancedQuery);
}

function extractYear(pubdate: string) {
  const match = pubdate.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : "n.d.";
}

function doiUrl(doi: string) {
  return doi ? `https://doi.org/${doi}` : "";
}

function formatCitation(article: Article, style: CitationStyle, index: number) {
  const authors = cleanText(article.authors || "Unknown author");
  const title = cleanText(article.title || "Untitled");
  const journal = cleanText(article.journal || "Unknown journal");
  const pubdate = cleanText(article.pubdate || "");
  const year = extractYear(pubdate);
  const doi = cleanText(article.doi || "");
  const doiPart = doi ? ` doi: ${doi}.` : "";
  const doiLink = doi ? doiUrl(doi) : article.sourceUrl;

  if (style === "IEEE") {
    return `[${index}] ${authors}, "${title}," ${journal}, ${pubdate}.${doiPart}`;
  }

  if (style === "Vancouver") {
    return `${authors}. ${title}. ${journal}. ${pubdate}.${doi ? ` doi: ${doi}.` : ""}`;
  }

  return `${authors}. (${year}). ${title}. ${journal}. ${
    doi ? doiLink : article.sourceUrl
  }`;
}

function makeSafeFileName(value: string) {
  return value
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export default function Home() {
  const { isLoaded, isSignedIn } = useUser();

  const [language, setLanguage] = useState<Language>("en");
  const t = uiText[language];
  const isArabic = language === "ar";

  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [fromYear, setFromYear] = useState("2023");
  const [toYear, setToYear] = useState("2026");
  const [articles, setArticles] = useState<Article[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");

  const [citationStyle, setCitationStyle] = useState<CitationStyle>("IEEE");
  const [quartileFilter, setQuartileFilter] = useState<QuartileFilter>("All");
  const [toastMessage, setToastMessage] = useState("");

  const filteredArticles = useMemo(() => {
    if (quartileFilter === "All") return articles;

    if (quartileFilter === "Not found") {
      return articles.filter(
        (article) => !article.quartile || article.quartile === "Not found"
      );
    }

    return articles.filter((article) => article.quartile === quartileFilter);
  }, [articles, quartileFilter]);

  useEffect(() => {
    async function loadNews() {
      try {
        const response = await fetch("/api/news");

        if (!response.ok) {
          throw new Error("News request failed");
        }

        const data = await response.json();

        if (Array.isArray(data)) {
          setNewsItems(data);
        }
      } catch (error) {
        console.error("Could not load news:", error);
        setNewsItems([]);
      } finally {
        setNewsLoading(false);
      }
    }

    loadNews();
  }, []);

  function showToast(message: string) {
    setToastMessage(message);

    window.setTimeout(() => {
      setToastMessage("");
    }, 2200);
  }

  async function handleSearch() {
    const cleanQuery = query.trim();

    if (!cleanQuery) {
      setSearchMessage(t.emptyQuery);
      return;
    }

    const finalQuery = hasArabic(cleanQuery)
      ? enhanceArabicQuery(cleanQuery)
      : cleanQuery;

    setSearchLoading(true);
    setSearchMessage("");
    setArticles([]);
    setQuartileFilter("All");

    try {
      const params = new URLSearchParams({
        query: finalQuery,
        fromYear,
        toYear,
      });

      const response = await fetch(`/api/search?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Search request failed");
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("Unexpected search response");
      }

      setArticles(data);

      if (data.length === 0) {
        setSearchMessage(t.noResults);
      } else {
        setSearchMessage(`${data.length} ${t.foundResults}`);
      }
    } catch (error) {
      console.error("Search failed:", error);
      setSearchMessage(t.searchFailed);
    } finally {
      setSearchLoading(false);
    }
  }

  async function copyCitation(article: Article, index: number) {
    const citation = formatCitation(article, citationStyle, index);

    try {
      await navigator.clipboard.writeText(citation);
      showToast(`${t.copied} ${citationStyle}`);
    } catch (error) {
      console.error("Copy failed:", error);
      showToast(t.copyFailed);
    }
  }

  async function downloadWord() {
    if (filteredArticles.length === 0) {
      showToast(t.noDownloadResults);
      return;
    }

    const children: Paragraph[] = [
      new Paragraph({
        children: [
          new TextRun({
            text: "ResearchRanker References",
            bold: true,
            size: 32,
          }),
        ],
        spacing: { after: 260 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Citation style: ${citationStyle}`,
            bold: true,
          }),
        ],
        spacing: { after: 220 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Search query: ${query || "Not specified"}`,
          }),
        ],
        spacing: { after: 260 },
      }),
    ];

    filteredArticles.forEach((article, index) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: formatCitation(article, citationStyle, index + 1),
            }),
          ],
          spacing: { after: 180 },
        })
      );

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Journal: ${article.journal} | Quartile: ${
                article.quartile || "Not found"
              } | Indexing Status: ${
                article.indexingStatus || "Unknown / check manually"
              }`,
              italics: true,
              size: 20,
            }),
          ],
          spacing: { after: 160 },
        })
      );
    });

    const document = new Document({
      sections: [
        {
          children,
        },
      ],
    });

    const blob = await Packer.toBlob(document);
    const fileName = `ResearchRanker-${citationStyle}-${makeSafeFileName(
      query || "results"
    )}.docx`;

    saveAs(blob, fileName);
    showToast(`${t.wordDownloaded} ${citationStyle}`);
  }

  return (
    <main
      dir={isArabic ? "rtl" : "ltr"}
      className="min-h-screen bg-gray-100 p-4 md:p-8"
    >
      {toastMessage && (
        <div
          className={`fixed top-5 z-50 rounded-xl bg-black px-5 py-3 text-sm font-bold text-white shadow-lg ${
            isArabic ? "left-5" : "right-5"
          }`}
        >
          {toastMessage}
        </div>
      )}

      <div className="mx-auto max-w-6xl rounded-2xl bg-white p-6 shadow md:p-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">{t.appTitle}</h1>

            <p className="mt-3 max-w-3xl text-gray-600">{t.appSubtitle}</p>

            <p className="mt-2 text-sm font-semibold text-gray-500">
              {t.createdBy} ·{" "}
              <a
                href="mailto:husseinjk40@gmail.com"
                className="text-blue-600 underline"
              >
                husseinjk40@gmail.com
              </a>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value as Language)}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-bold"
              aria-label={t.language}
            >
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>

            {!isLoaded && <span className="text-sm text-gray-500">{t.loading}</span>}

            {isLoaded && !isSignedIn && (
              <>
                <SignInButton mode="modal">
                  <button className="rounded-xl bg-black px-5 py-3 text-sm font-bold text-white transition active:scale-95 hover:bg-gray-800">
                    {t.signIn}
                  </button>
                </SignInButton>

                <span className="text-sm font-semibold text-gray-500">
                  {t.guestMode}
                </span>
              </>
            )}

            {isLoaded && isSignedIn && (
              <>
                <span className="text-sm font-semibold text-gray-600">
                  {t.signedIn}
                </span>
                <UserButton />
              </>
            )}
          </div>
        </header>

        <section className="mt-8 rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-blue-700">
                {t.newsLabel}
              </p>

              <h2 className="mt-1 text-2xl font-bold text-gray-900">
                {t.newsTitle}
              </h2>

              <p className="mt-2 text-sm text-gray-600">{t.newsDescription}</p>
            </div>

            <a
              href="/api/news"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-black px-5 py-3 text-sm font-bold text-white transition active:scale-95"
            >
              {t.openNewsApi}
            </a>
          </div>

          {newsLoading && (
            <p className="mt-5 text-sm font-semibold text-gray-600">
              {t.loadingNews}
            </p>
          )}

          {!newsLoading && newsItems.length === 0 && (
            <p className="mt-5 rounded-xl bg-yellow-50 p-4 text-sm font-semibold text-yellow-900">
              {t.noNews}
            </p>
          )}

          {!newsLoading && newsItems.length > 0 && (
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              {newsItems.slice(0, 6).map((item) => (
                <a
                  key={`${item.source}-${item.link}`}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-blue-100 bg-white p-4 transition active:scale-[0.99] hover:bg-blue-50"
                >
                  <div className="text-xs font-bold uppercase tracking-wide text-gray-500">
                    {item.source}
                    {item.date ? ` · ${item.date}` : ""}
                  </div>

                  <h3 className="mt-2 text-base font-bold text-gray-900">
                    {item.title}
                  </h3>

                  {item.summary && (
                    <p className="mt-2 text-sm text-gray-600">{item.summary}</p>
                  )}
                </a>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-gray-200 p-5">
          <h2 className="text-2xl font-bold text-gray-900">{t.searchTitle}</h2>

          <p className="mt-2 text-gray-600">{t.searchDescription}</p>

          {isArabic && (
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              {t.arabicSearchNote}
            </p>
          )}

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-6">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.searchPlaceholder}
              className="rounded-xl border border-gray-300 p-3 md:col-span-3"
            />

            <input
              type="number"
              value={fromYear}
              onChange={(event) => setFromYear(event.target.value)}
              className="rounded-xl border border-gray-300 p-3"
              placeholder={t.fromYear}
            />

            <input
              type="number"
              value={toYear}
              onChange={(event) => setToYear(event.target.value)}
              className="rounded-xl border border-gray-300 p-3"
              placeholder={t.toYear}
            />

            <button
              type="button"
              onClick={handleSearch}
              disabled={searchLoading}
              className="rounded-xl bg-black px-5 py-3 font-bold text-white transition active:scale-95 disabled:bg-gray-400"
            >
              {searchLoading ? t.searching : t.search}
            </button>
          </div>

          {searchMessage && (
            <p className="mt-4 rounded-xl bg-gray-50 p-3 text-sm font-semibold text-gray-700">
              {searchMessage}
            </p>
          )}

          {articles.length > 0 && (
            <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm font-bold text-gray-700">
                    {t.citationStyle}
                  </label>
                  <select
                    value={citationStyle}
                    onChange={(event) =>
                      setCitationStyle(event.target.value as CitationStyle)
                    }
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white p-3"
                  >
                    {citationStyles.map((style) => (
                      <option key={style} value={style}>
                        {style}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-700">
                    {t.quartileFilter}
                  </label>
                  <select
                    value={quartileFilter}
                    onChange={(event) =>
                      setQuartileFilter(event.target.value as QuartileFilter)
                    }
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white p-3"
                  >
                    {quartileFilters.map((filter) => (
                      <option key={filter} value={filter}>
                        {filter}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={downloadWord}
                    className="w-full rounded-xl bg-blue-700 px-5 py-3 font-bold text-white transition active:scale-95 hover:bg-blue-800"
                  >
                    {t.downloadWord}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 space-y-4">
            {filteredArticles.map((article, index) => (
              <article
                key={article.pmid}
                className="rounded-xl border border-gray-200 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-gray-500">
                      {article.source} · PMID: {article.pmid}
                    </div>

                    <h3 className="mt-2 text-lg font-bold text-gray-900">
                      {article.title}
                    </h3>
                  </div>

                  <span
                    className={`inline-flex w-fit rounded-full border px-3 py-1 text-sm font-bold ${getQuartileBadgeClass(
                      article.quartile
                    )}`}
                  >
                    {article.quartile || "Not found"}
                  </span>
                </div>

                <p className="mt-3 text-sm text-gray-700">
                  <strong>{t.journal}:</strong> {article.journal}
                </p>

                <p className="mt-1 text-sm text-gray-700">
                  <strong>{t.date}:</strong> {article.pubdate}
                </p>

                {article.authors && (
                  <p className="mt-1 text-sm text-gray-700">
                    <strong>{t.authors}:</strong> {article.authors}
                  </p>
                )}

                {article.doi && (
                  <p className="mt-1 text-sm text-gray-700">
                    <strong>{t.doi}:</strong> {article.doi}
                  </p>
                )}

                <div className="mt-4 grid grid-cols-1 gap-2 rounded-xl bg-gray-50 p-4 text-sm text-gray-700 md:grid-cols-2">
                  <p>
                    <strong>{t.quartile}:</strong>{" "}
                    <span className="font-bold text-blue-700">
                      {article.quartile || "Not found"}
                    </span>
                  </p>

                  <p>
                    <strong>{t.indexingStatus}:</strong>{" "}
                    <span className="font-bold text-green-700">
                      {article.indexingStatus || "Unknown / check manually"}
                    </span>
                  </p>

                  {article.sjr && (
                    <p>
                      <strong>SJR:</strong> {article.sjr}
                    </p>
                  )}

                  {article.hIndex && (
                    <p>
                      <strong>H-index:</strong> {article.hIndex}
                    </p>
                  )}

                  {article.publisher && (
                    <p>
                      <strong>{t.publisher}:</strong> {article.publisher}
                    </p>
                  )}

                  {article.issn && (
                    <p>
                      <strong>{t.issn}:</strong> {article.issn}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => copyCitation(article, index + 1)}
                    className="rounded-xl bg-black px-4 py-2 text-sm font-bold text-white transition active:scale-95 hover:bg-gray-800"
                  >
                    {t.copySource}
                  </button>

                  <a
                    href={article.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-blue-200 px-4 py-2 text-sm font-bold text-blue-700 transition active:scale-95 hover:bg-blue-50"
                  >
                    {t.openPubMed}
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-5">
          <h2 className="text-xl font-bold text-gray-900">{t.support}</h2>

          <p className="mt-2 text-sm text-gray-700">{t.supportDescription}</p>

          <a
            href="mailto:husseinjk40@gmail.com?subject=ResearchRanker Support Request"
            className="mt-4 inline-block rounded-xl bg-black px-5 py-3 text-sm font-bold text-white transition active:scale-95"
          >
            {t.contactSupport}
          </a>
        </section>
      </div>
    </main>
  );
}