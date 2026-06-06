"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  matchConfidence: string;
  abstract?: string;
};
type AiSummary = {
  objective: string;
  methodology: string;
  keyFindings: string[];
  conclusion: string;
  researchValue: string;
  limitation: string;
};
type JournalCarouselItem = {
  journal: string;
  quartile: string;
  indexingStatus: string;
  sjr: string;
  hIndex: string;
  publisher: string;
  issn: string;
};
type CitationStyle = "IEEE" | "Vancouver" | "APA";
type QuartileFilter = "All" | "Q1" | "Q2" | "Q3" | "Q4" | "Not found";
type SortOption =
  | "Newest first"
  | "Q1 first"
  | "DOI first"
  | "SCImago indexed first";
  type DoiFilter = "All" | "Has DOI" | "No DOI";
  type MatchConfidenceFilter =
  | "All"
  | "Exact title match"
  | "Approximate title match"
  | "Not matched";
type Language = "en" | "ar";
type QualityDashboardStats = {
  total: number;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  notFound: number;
  withDoi: number;
  scimagoIndexed: number;
};
type SavedSearch = {
  id: string;
  query: string;
  fromYear: string;
  toYear: string;
  createdAt: string;
};
type SearchHistoryItem = {
  id: string;
  query: string;
  fromYear: string;
  toYear: string;
  searchedAt: string;
};
const SAVED_SEARCHES_STORAGE_KEY = "researchranker_saved_searches";
const SEARCH_HISTORY_STORAGE_KEY = "researchranker_search_history";
const citationStyles: CitationStyle[] = ["IEEE", "Vancouver", "APA"];
const quartileFilters: QuartileFilter[] = [
  "All",
  "Q1",
  "Q2",
  "Q3",
  "Q4",
  "Not found",
];
const sortOptions: SortOption[] = [
  "Newest first",
  "Q1 first",
  "DOI first",
  "SCImago indexed first",
];
const doiFilters: DoiFilter[] = ["All", "Has DOI", "No DOI"];
const matchConfidenceFilters: MatchConfidenceFilter[] = [
  "All",
  "Exact title match",
  "Approximate title match",
  "Not matched",
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
    openNewsApi: "View news",
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
    saveToLibrary: "Save to Library",
savedToLibrary: "Saved to Library",
myLibrary: "My Library",
deleteFromLibrary: "Delete",
libraryEmpty: "No saved articles yet.",
libraryLoginRequired: "Sign in to save articles.",
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
    saveToLibrary: "حفظ في المكتبة",
savedToLibrary: "تم الحفظ في المكتبة",
myLibrary: "مكتبتي",
deleteFromLibrary: "حذف",
libraryEmpty: "لا توجد مصادر محفوظة بعد.",
libraryLoginRequired: "سجّل الدخول حتى تحفظ المصادر.",
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
function getMatchConfidenceBadgeClass(matchConfidence: string) {
  if (matchConfidence === "Exact title match") {
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }

  if (matchConfidence === "Approximate title match") {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }

  return "bg-gray-100 text-gray-800 border-gray-200";
}
function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeNewsText(value: string) {
  return (value || "")
    .replaceAll("â€™", "’")
    .replaceAll("â€˜", "‘")
    .replaceAll("â€œ", "“")
    .replaceAll("â€", "”")
    .replaceAll("â€“", "–")
    .replaceAll("â€”", "—")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("<![CDATA[", "")
    .replaceAll("]]>", "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

function escapeExportValue(value: string) {
  return cleanText(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}");
}

function getArticleAuthors(article: Article) {
  const authors = cleanText(article.authors || "");

  if (!authors) {
    return ["Unknown author"];
  }

  if (authors.includes(";")) {
    return authors
      .split(";")
      .map((author) => cleanText(author))
      .filter(Boolean);
  }

  return authors
    .split(",")
    .map((author) => cleanText(author))
    .filter(Boolean)
    .slice(0, 20);
}

function makeBibTeXKey(article: Article, index: number) {
  const firstAuthor =
    getArticleAuthors(article)[0]
      ?.split(/\s+/)[0]
      ?.replace(/[^a-zA-Z0-9]/g, "") || "article";
  const year = extractYear(article.pubdate);
  const safeTitleWord =
    article.title
      ?.split(/\s+/)
      .find((word) => word.length > 4)
      ?.replace(/[^a-zA-Z0-9]/g, "") || "research";

  return `${firstAuthor}${year}${safeTitleWord}${index}`;
}

function formatBibTeX(article: Article, index: number) {
  const authors = getArticleAuthors(article).join(" and ");
  const year = extractYear(article.pubdate);
  const doi = cleanText(article.doi || "");
  const url = doi ? doiUrl(doi) : article.sourceUrl;

  return `@article{${makeBibTeXKey(article, index)},
  title = {${escapeExportValue(article.title || "Untitled")}},
  author = {${escapeExportValue(authors)}},
  journal = {${escapeExportValue(article.journal || "Unknown journal")}},
  year = {${escapeExportValue(year)}},
  date = {${escapeExportValue(article.pubdate || "")}},
  doi = {${escapeExportValue(doi)}},
  url = {${escapeExportValue(url || "")}},
  note = {Quartile: ${escapeExportValue(article.quartile || "Not found")}; Indexing: ${escapeExportValue(article.indexingStatus || "Unknown")}}
}`;
}

function formatRIS(article: Article) {
  const authors = getArticleAuthors(article);
  const year = extractYear(article.pubdate);
  const doi = cleanText(article.doi || "");
  const url = doi ? doiUrl(doi) : article.sourceUrl;

  const lines = [
    "TY  - JOUR",
    ...authors.map((author) => `AU  - ${author}`),
    `TI  - ${cleanText(article.title || "Untitled")}`,
    `JO  - ${cleanText(article.journal || "Unknown journal")}`,
    `PY  - ${year}`,
    `DA  - ${cleanText(article.pubdate || "")}`,
    doi ? `DO  - ${doi}` : "",
    url ? `UR  - ${url}` : "",
    article.pmid ? `AN  - PMID:${article.pmid}` : "",
    article.quartile ? `N1  - Quartile: ${article.quartile}` : "",
    article.indexingStatus ? `N1  - Indexing status: ${article.indexingStatus}` : "",
    "ER  -",
  ];

  return lines.filter(Boolean).join("\n");
}

export default function Home() {
  const { isLoaded, isSignedIn } = useUser();

  const [language, setLanguage] = useState<Language>("en");
  const t = uiText[language];
  const isArabic = language === "ar";

  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);

const [query, setQuery] = useState("");
const [fromYear, setFromYear] = useState("1990");
const [toYear, setToYear] = useState("2026");
const [maxResults, setMaxResults] = useState("50");
const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
const [articles, setArticles] = useState<Article[]>([]);
const [savingLibraryIds, setSavingLibraryIds] = useState<Record<string, boolean>>({});
const [savedLibraryIds, setSavedLibraryIds] = useState<Record<string, boolean>>({});
const [libraryArticles, setLibraryArticles] = useState<Article[]>([]);
const [libraryLoading, setLibraryLoading] = useState(false);
const [showLibrary, setShowLibrary] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");

const [citationStyle, setCitationStyle] = useState<CitationStyle>("IEEE");
const [quartileFilter, setQuartileFilter] = useState<QuartileFilter>("All");
const [doiFilter, setDoiFilter] = useState<DoiFilter>("All");
const [journalFilter, setJournalFilter] = useState("");
const [matchConfidenceFilter, setMatchConfidenceFilter] =
  useState<MatchConfidenceFilter>("All");
const [sortOption, setSortOption] = useState<SortOption>("Newest first");
const [toastMessage, setToastMessage] = useState("");
const [aiSummaries, setAiSummaries] = useState<Record<string, AiSummary>>({});
const [aiSummaryLoading, setAiSummaryLoading] = useState<Record<string, boolean>>({});
const [aiSummaryError, setAiSummaryError] = useState<Record<string, string>>({});
const resultsSectionRef = useRef<HTMLDivElement | null>(null);
const newsSliderRef = useRef<HTMLDivElement | null>(null);
const journalSliderRef = useRef<HTMLDivElement | null>(null);
const filteredArticles = useMemo(() => {
  let result = [...articles];

  if (quartileFilter !== "All") {
    if (quartileFilter === "Not found") {
      result = result.filter(
        (article) => !article.quartile || article.quartile === "Not found"
      );
    } else {
      result = result.filter((article) => article.quartile === quartileFilter);
    }
  }
if (doiFilter === "Has DOI") {
  result = result.filter((article) => Boolean(article.doi));
}

if (doiFilter === "No DOI") {
  result = result.filter((article) => !article.doi);
}
if (journalFilter.trim()) {
  const normalizedJournalFilter = journalFilter.toLowerCase().trim();

  result = result.filter((article) =>
    article.journal.toLowerCase().includes(normalizedJournalFilter)
  );
}

if (matchConfidenceFilter !== "All") {
  result = result.filter(
    (article) => article.matchConfidence === matchConfidenceFilter
  );
}
  const getQuartileRank = (quartile: string) => {
    if (quartile === "Q1") return 1;
    if (quartile === "Q2") return 2;
    if (quartile === "Q3") return 3;
    if (quartile === "Q4") return 4;
    return 5;
  };

  const getYear = (pubdate: string) => {
    const match = pubdate.match(/\b(19|20)\d{2}\b/);
    return match ? Number(match[0]) : 0;
  };

  if (sortOption === "Newest first") {
    result.sort((a, b) => getYear(b.pubdate) - getYear(a.pubdate));
  }

  if (sortOption === "Q1 first") {
    result.sort(
      (a, b) => getQuartileRank(a.quartile) - getQuartileRank(b.quartile)
    );
  }

  if (sortOption === "DOI first") {
    result.sort((a, b) => Number(Boolean(b.doi)) - Number(Boolean(a.doi)));
  }

  if (sortOption === "SCImago indexed first") {
    result.sort(
      (a, b) =>
        Number(b.indexingStatus?.includes("SCImago Indexed")) -
        Number(a.indexingStatus?.includes("SCImago Indexed"))
    );
  }

  return result;
}, [
  articles,
  quartileFilter,
  doiFilter,
  journalFilter,
  matchConfidenceFilter,
  sortOption,
]);
const activeFilters = useMemo(() => {
  const filters: {
    key: string;
    label: string;
    clear: () => void;
  }[] = [];

  if (quartileFilter !== "All") {
    filters.push({
      key: "quartile",
      label: `Quartile: ${quartileFilter}`,
      clear: () => setQuartileFilter("All"),
    });
  }

  if (doiFilter !== "All") {
    filters.push({
      key: "doi",
      label: `DOI: ${doiFilter}`,
      clear: () => setDoiFilter("All"),
    });
  }

  if (journalFilter.trim()) {
    filters.push({
      key: "journal",
      label: `Journal: ${journalFilter.trim()}`,
      clear: () => setJournalFilter(""),
    });
  }

  if (matchConfidenceFilter !== "All") {
    filters.push({
      key: "matchConfidence",
      label: `Match: ${matchConfidenceFilter}`,
      clear: () => setMatchConfidenceFilter("All"),
    });
  }

  if (sortOption !== "Newest first") {
    filters.push({
      key: "sort",
      label: `Sort: ${sortOption}`,
      clear: () => setSortOption("Newest first"),
    });
  }

  return filters;
}, [
  quartileFilter,
  doiFilter,
  journalFilter,
  matchConfidenceFilter,
  sortOption,
]);
const qualityDashboardStats = useMemo<QualityDashboardStats>(() => {
  return articles.reduce(
    (stats, article) => {
      const quartile = article.quartile || "Not found";

      stats.total += 1;

      if (quartile === "Q1") stats.q1 += 1;
      else if (quartile === "Q2") stats.q2 += 1;
      else if (quartile === "Q3") stats.q3 += 1;
      else if (quartile === "Q4") stats.q4 += 1;
      else stats.notFound += 1;

      if (article.doi) {
        stats.withDoi += 1;
      }

      if (
        article.indexingStatus &&
        article.indexingStatus.toLowerCase().includes("scimago indexed")
      ) {
        stats.scimagoIndexed += 1;
      }

      return stats;
    },
    {
      total: 0,
      q1: 0,
      q2: 0,
      q3: 0,
      q4: 0,
      notFound: 0,
      withDoi: 0,
      scimagoIndexed: 0,
    }
  );
}, [articles]);
const journalCarouselItems = useMemo<JournalCarouselItem[]>(() => {
  const journals = new Map<string, JournalCarouselItem>();

  articles.forEach((article) => {
    const journalKey = article.journal.toLowerCase().trim();

    if (!journalKey || journals.has(journalKey)) {
      return;
    }

    journals.set(journalKey, {
      journal: article.journal,
      quartile: article.quartile || "Not found",
      indexingStatus: article.indexingStatus || "Unknown / check manually",
      sjr: article.sjr,
      hIndex: article.hIndex,
      publisher: article.publisher,
      issn: article.issn,
    });
  });

  return Array.from(journals.values()).slice(0, 30);
}, [articles]);

const publicationYearStats = useMemo(() => {
  const yearCounts = new Map<number, number>();

  filteredArticles.forEach((article) => {
    const year = Number(extractYear(article.pubdate));

    if (!Number.isFinite(year)) {
      return;
    }

    yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
  });

  const items = Array.from(yearCounts.entries())
    .sort(([yearA], [yearB]) => yearA - yearB)
    .map(([year, count]) => ({ year, count }));

  const maxCount = Math.max(...items.map((item) => item.count), 1);

  return {
    items,
    maxCount,
  };
}, [filteredArticles]);
useEffect(() => {
  try {
    const saved = window.localStorage.getItem(SAVED_SEARCHES_STORAGE_KEY);

    if (!saved) {
      return;
    }

    const parsed = JSON.parse(saved);

    if (Array.isArray(parsed)) {
      setSavedSearches(parsed);
    }
  } catch (error) {
    console.error("Could not load saved searches:", error);
    setSavedSearches([]);
  }
}, []);

useEffect(() => {
  try {
    const saved = window.localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);

    if (!saved) {
      return;
    }

    const parsed = JSON.parse(saved);

    if (Array.isArray(parsed)) {
      setSearchHistory(parsed);
    }
  } catch (error) {
    console.error("Could not load search history:", error);
    setSearchHistory([]);
  }
}, []);
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

function scrollSlider(
  ref: { current: HTMLDivElement | null },
  direction: "left" | "right"
) {
  const element = ref.current;

  if (!element) {
    return;
  }

  element.scrollBy({
    left: direction === "right" ? 360 : -360,
    behavior: "smooth",
  });
}
function resetFilters() {
  setQuartileFilter("All");
  setDoiFilter("All");
  setJournalFilter("");
  setMatchConfidenceFilter("All");
  setSortOption("Newest first");
  showToast(isArabic ? "تمت إعادة ضبط الفلاتر" : "Filters reset");
}
function jumpToResultsWithQuartile(filter: QuartileFilter) {
  setQuartileFilter(filter);

  window.setTimeout(() => {
    resultsSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, 100);
}
function jumpToResultsWithDoi() {
  setDoiFilter("Has DOI");

  window.setTimeout(() => {
    resultsSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, 100);
}

function jumpToResultsWithScimagoIndexed() {
  setSortOption("SCImago indexed first");

  window.setTimeout(() => {
    resultsSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, 100);
}
function addSearchToHistory(searchQuery: string) {
  const cleanSearchQuery = searchQuery.trim();

  if (!cleanSearchQuery) {
    return;
  }

  const newHistoryItem: SearchHistoryItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    query: cleanSearchQuery,
    fromYear,
    toYear,
    searchedAt: new Date().toISOString(),
  };

  const updatedHistory = [
    newHistoryItem,
    ...searchHistory.filter(
      (item) =>
        !(
          item.query.toLowerCase() === cleanSearchQuery.toLowerCase() &&
          item.fromYear === fromYear &&
          item.toYear === toYear
        )
    ),
  ].slice(0, 10);

  setSearchHistory(updatedHistory);
  window.localStorage.setItem(
    SEARCH_HISTORY_STORAGE_KEY,
    JSON.stringify(updatedHistory)
  );
}
function saveCurrentSearch() {
  const cleanQuery = query.trim();

  if (!cleanQuery) {
    showToast(isArabic ? "اكتب بحثاً أولاً" : "Enter a search first");
    return;
  }

  const newSavedSearch: SavedSearch = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    query: cleanQuery,
    fromYear,
    toYear,
    createdAt: new Date().toISOString(),
  };

  const updatedSavedSearches = [
    newSavedSearch,
    ...savedSearches.filter(
      (item) =>
        !(
          item.query.toLowerCase() === cleanQuery.toLowerCase() &&
          item.fromYear === fromYear &&
          item.toYear === toYear
        )
    ),
  ].slice(0, 10);

  setSavedSearches(updatedSavedSearches);
  window.localStorage.setItem(
    SAVED_SEARCHES_STORAGE_KEY,
    JSON.stringify(updatedSavedSearches)
  );

  showToast(isArabic ? "تم حفظ البحث" : "Search saved");
}
function loadSavedSearch(savedSearch: SavedSearch) {
  async function runSavedSearch(savedSearch: SavedSearch) {
  setQuery(savedSearch.query);
  setFromYear(savedSearch.fromYear);
  setToYear(savedSearch.toYear);

  setSearchLoading(true);
  setSearchMessage("");
  setArticles([]);
  setQuartileFilter("All");

  try {
    const finalQuery = hasArabic(savedSearch.query)
      ? enhanceArabicQuery(savedSearch.query)
      : savedSearch.query;

    addSearchToHistory(savedSearch.query);

    const params = new URLSearchParams({
      query: finalQuery,
      fromYear: savedSearch.fromYear,
      toYear: savedSearch.toYear,
      maxResults,
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

    showToast(isArabic ? "تم تشغيل البحث المحفوظ" : "Saved search started");
  } catch (error) {
    console.error("Saved search failed:", error);
    setSearchMessage(t.searchFailed);
  } finally {
    setSearchLoading(false);
  }
}
  setQuery(savedSearch.query);
  setFromYear(savedSearch.fromYear);
  setToYear(savedSearch.toYear);
  showToast(isArabic ? "تم تحميل البحث المحفوظ" : "Saved search loaded");
}
async function runSavedSearch(savedSearch: SavedSearch) {
  setQuery(savedSearch.query);
  setFromYear(savedSearch.fromYear);
  setToYear(savedSearch.toYear);

  setSearchLoading(true);
  setSearchMessage("");
  setArticles([]);
  setQuartileFilter("All");

  try {
    const finalQuery = hasArabic(savedSearch.query)
      ? enhanceArabicQuery(savedSearch.query)
      : savedSearch.query;

    addSearchToHistory(savedSearch.query);

    const params = new URLSearchParams({
      query: finalQuery,
      fromYear: savedSearch.fromYear,
      toYear: savedSearch.toYear,
      maxResults,
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

    showToast(isArabic ? "تم تشغيل البحث المحفوظ" : "Saved search started");
  } catch (error) {
    console.error("Saved search failed:", error);
    setSearchMessage(t.searchFailed);
  } finally {
    setSearchLoading(false);
  }
}
function deleteSavedSearch(id: string) {
  const updatedSavedSearches = savedSearches.filter((item) => item.id !== id);

  setSavedSearches(updatedSavedSearches);
  window.localStorage.setItem(
    SAVED_SEARCHES_STORAGE_KEY,
    JSON.stringify(updatedSavedSearches)
  );

  showToast(isArabic ? "تم حذف البحث المحفوظ" : "Saved search deleted");
}
function loadHistoryItem(historyItem: SearchHistoryItem) {
  setQuery(historyItem.query);
  setFromYear(historyItem.fromYear);
  setToYear(historyItem.toYear);
  showToast(isArabic ? "تم تحميل بحث من السجل" : "Search history item loaded");
}
async function runHistorySearch(historyItem: SearchHistoryItem) {
  setQuery(historyItem.query);
  setFromYear(historyItem.fromYear);
  setToYear(historyItem.toYear);

  setSearchLoading(true);
  setSearchMessage("");
  setArticles([]);
  setQuartileFilter("All");

  try {
    const finalQuery = hasArabic(historyItem.query)
      ? enhanceArabicQuery(historyItem.query)
      : historyItem.query;

    const params = new URLSearchParams({
      query: finalQuery,
      fromYear: historyItem.fromYear,
      toYear: historyItem.toYear,
      maxResults,
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

    showToast(isArabic ? "تم تشغيل البحث من السجل" : "History search started");
  } catch (error) {
    console.error("History search failed:", error);
    setSearchMessage(t.searchFailed);
  } finally {
    setSearchLoading(false);
  }
}
function clearSearchHistory() {
  setSearchHistory([]);
  window.localStorage.removeItem(SEARCH_HISTORY_STORAGE_KEY);
  showToast(isArabic ? "تم حذف سجل البحث" : "Search history cleared");
}

async function summarizeArticle(article: Article) {
  if (aiSummaries[article.pmid]) {
    return;
  }

  setAiSummaryLoading((current) => ({ ...current, [article.pmid]: true }));
  setAiSummaryError((current) => ({ ...current, [article.pmid]: "" }));

  try {
    const response = await fetch("/api/ai/summarize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: article.title,
        journal: article.journal,
        pubdate: article.pubdate,
        authors: article.authors,
        doi: article.doi,
        abstract: article.abstract || "",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "AI summary request failed.");
    }

    setAiSummaries((current) => ({
      ...current,
      [article.pmid]: {
        objective: data.objective || "Not specified",
        methodology: data.methodology || "Not specified",
        keyFindings: Array.isArray(data.keyFindings)
          ? data.keyFindings
          : ["Not specified"],
        conclusion: data.conclusion || "Not specified",
        researchValue: data.researchValue || "Not specified",
        limitation: data.limitation || "Not specified",
      },
    }));
  } catch (error) {
    console.error("AI summary failed:", error);
    setAiSummaryError((current) => ({
      ...current,
      [article.pmid]: isArabic
        ? "تعذر إنشاء الملخص الذكي حالياً. تحقق من مفتاح Gemini أو حاول لاحقاً."
        : "AI summary could not be generated now. Check the Gemini key or try again later.",
    }));
  } finally {
    setAiSummaryLoading((current) => ({ ...current, [article.pmid]: false }));
  }
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
addSearchToHistory(cleanQuery);
    setSearchLoading(true);
    setSearchMessage("");
    setArticles([]);
    setQuartileFilter("All");

    try {
      const params = new URLSearchParams({
        query: finalQuery,
        fromYear,
        toYear,
        maxResults,

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
async function saveArticleToLibrary(article: Article) {
  const articleId = article.pmid || article.title;

  if (!articleId) {
    showToast(t.copyFailed || "Could not save the article.");
    return;
  }

  setSavingLibraryIds((current) => ({
    ...current,
    [articleId]: true,
  }));

  try {
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
        sjr: article.sjr,
        hIndex: article.hIndex,
        publisher: article.publisher,
        pubmedUrl: article.sourceUrl,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      showToast(data?.error || t.libraryLoginRequired);
      return;
    }

    setSavedLibraryIds((current) => ({
      ...current,
      [articleId]: true,
    }));

    showToast(t.savedToLibrary);
  } catch (error) {
    console.error("Save article failed:", error);
    showToast(t.copyFailed || "Could not save the article.");
  } finally {
    setSavingLibraryIds((current) => ({
      ...current,
      [articleId]: false,
    }));
  }
}

async function loadLibraryArticles() {
  setLibraryLoading(true);

  try {
    const response = await fetch("/api/library/list");
    const data = await response.json();

    if (!response.ok) {
      showToast(data?.error || t.libraryLoginRequired);
      return;
    }

    const loadedArticles: Article[] = Array.isArray(data.articles)
      ? data.articles.map((article: Partial<Article> & { pubmedUrl?: string }) => ({
          pmid: article.pmid || "",
          title: article.title || "",
          journal: article.journal || "",
          pubdate: article.pubdate || "",
          authors: article.authors || "",
          doi: article.doi || "",
          source: article.source || "PUBMED",
          sourceUrl: article.sourceUrl || article.pubmedUrl || "",
          quartile: article.quartile || "Not found",
          indexingStatus: article.indexingStatus || "",
          sjr: article.sjr || "",
          hIndex: article.hIndex || "",
          publisher: article.publisher || "",
          issn: article.issn || "",
          matchConfidence: article.matchConfidence || "",
          abstract: article.abstract || "",
        }))
      : [];

    setLibraryArticles(loadedArticles);
    setShowLibrary(true);

    const savedIds = loadedArticles.reduce<Record<string, boolean>>((current, article) => {
      const articleId = article.pmid || article.title;

      if (articleId) {
        current[articleId] = true;
      }

      return current;
    }, {});

    setSavedLibraryIds((current) => ({
      ...current,
      ...savedIds,
    }));
  } catch (error) {
    console.error("Load library failed:", error);
    showToast(t.copyFailed || "Could not load library.");
  } finally {
    setLibraryLoading(false);
  }
}

async function deleteArticleFromLibrary(articleId: string) {
  try {
    const response = await fetch("/api/library/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: articleId }),
    });

    const data = await response.json();

    if (!response.ok) {
      showToast(data?.error || "Could not delete article.");
      return;
    }

    setLibraryArticles((current) =>
      current.filter((article) => (article.pmid || article.title) !== articleId)
    );

    setSavedLibraryIds((current) => ({
      ...current,
      [articleId]: false,
    }));

    showToast(isArabic ? "تم حذف المصدر من المكتبة" : "Article removed from library.");
  } catch (error) {
    console.error("Delete library article failed:", error);
    showToast(t.copyFailed || "Could not delete article.");
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

  function downloadTextFile(content: string, fileName: string, mimeType: string) {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    saveAs(blob, fileName);
  }

  function downloadRIS() {
    if (filteredArticles.length === 0) {
      showToast(t.noDownloadResults);
      return;
    }

    const content = filteredArticles.map((article) => formatRIS(article)).join("\n\n");
    const fileName = `ResearchRanker-${makeSafeFileName(query || "results")}.ris`;

    downloadTextFile(content, fileName, "application/x-research-info-systems");
    showToast(isArabic ? "تم تحميل ملف RIS" : "RIS file downloaded");
  }

  function downloadBibTeX() {
    if (filteredArticles.length === 0) {
      showToast(t.noDownloadResults);
      return;
    }

    const content = filteredArticles
      .map((article, index) => formatBibTeX(article, index + 1))
      .join("\n\n");
    const fileName = `ResearchRanker-${makeSafeFileName(query || "results")}.bib`;

    downloadTextFile(content, fileName, "application/x-bibtex");
    showToast(isArabic ? "تم تحميل ملف BibTeX" : "BibTeX file downloaded");
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
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-blue-700">
                {t.newsLabel}
              </p>

              <h2 className="mt-1 text-2xl font-bold text-gray-900">
                {t.newsTitle}
              </h2>

              <p className="mt-2 text-sm text-gray-600">{t.newsDescription}</p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => scrollSlider(newsSliderRef, "left")}
                className="rounded-full border border-blue-200 bg-white px-4 py-2 text-lg font-bold text-blue-800 shadow-sm transition active:scale-95 hover:bg-blue-100"
                aria-label={isArabic ? "الخبر السابق" : "Previous news"}
              >
                {isArabic ? "→" : "←"}
              </button>

              <button
                type="button"
                onClick={() => scrollSlider(newsSliderRef, "right")}
                className="rounded-full border border-blue-200 bg-white px-4 py-2 text-lg font-bold text-blue-800 shadow-sm transition active:scale-95 hover:bg-blue-100"
                aria-label={isArabic ? "الخبر التالي" : "Next news"}
              >
                {isArabic ? "←" : "→"}
              </button>
            </div>
          </div>

          {newsLoading && (
            <p className="mt-5 rounded-xl bg-white p-4 text-sm font-semibold text-gray-600">
              {t.loadingNews}
            </p>
          )}

          {!newsLoading && newsItems.length === 0 && (
            <p className="mt-5 rounded-xl bg-yellow-50 p-4 text-sm font-semibold text-yellow-900">
              {t.noNews}
            </p>
          )}

          {!newsLoading && newsItems.length > 0 && (
            <div className="relative mt-5">
              <div
                ref={newsSliderRef}
                className="flex snap-x snap-mandatory gap-4 overflow-x-hidden scroll-smooth pb-2"
              >
                {newsItems.slice(0, 12).map((item) => (
                  <article
                    key={`${item.source}-${item.link}`}
                    className="min-w-[320px] max-w-[320px] snap-start rounded-2xl border border-blue-100 bg-white p-5 shadow-sm transition active:scale-[0.99] md:min-w-[380px] md:max-w-[380px]"
                  >
                    <div className="text-xs font-bold uppercase tracking-wide text-gray-500">
                      {normalizeNewsText(item.source)}
                      {item.date ? ` · ${item.date}` : ""}
                    </div>

                    <h3 className="mt-3 line-clamp-3 text-lg font-bold text-gray-900">
                      {normalizeNewsText(item.title)}
                    </h3>

                    {item.summary && (
                      <p className="mt-3 line-clamp-4 text-sm leading-6 text-gray-600">
                        {normalizeNewsText(item.summary)}
                      </p>
                    )}

                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-5 inline-block rounded-xl bg-black px-4 py-2 text-sm font-bold text-white transition active:scale-95 hover:bg-gray-800"
                    >
                      {isArabic ? "قراءة الخبر" : "Read source"}
                    </a>
                  </article>
                ))}
              </div>
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

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-7">
           <input
  type="text"
  value={query}
  onChange={(event) => setQuery(event.target.value)}
  onKeyDown={(event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSearch();
    }
  }}
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
<select
  value={maxResults}
  onChange={(event) => setMaxResults(event.target.value)}
  className="rounded-xl border border-gray-300 bg-white p-3"
  aria-label={isArabic ? "عدد النتائج" : "Number of results"}
>
  <option value="20">20 results</option>
  <option value="50">50 results</option>
  <option value="100">100 results</option>
  <option value="200">200 results</option>
  <option value="500">500 results</option>
</select>
            <button
              type="button"
              onClick={handleSearch}
              disabled={searchLoading}
              className="rounded-xl bg-black px-5 py-3 font-bold text-white transition active:scale-95 disabled:bg-gray-400"
            >
              {searchLoading ? t.searching : t.search}
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {isArabic ? "البحث المتقدم Boolean Search" : "Advanced Boolean Search"}
                </h3>

                <p className="mt-1 text-sm text-gray-600">
                  {isArabic
                    ? "يمكنك استخدام AND و OR و NOT وعلامات التنصيص للبحث عن عبارة دقيقة. يتم إرسال الاستعلام كما هو إلى PubMed."
                    : "Use AND, OR, NOT, and quotation marks for exact phrases. The query is sent directly to PubMed."}
                </p>

                <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                  {[
                    '"chronic kidney disease" AND inflammation',
                    'zonulin AND hemodialysis NOT diabetes',
                    '(oxidative stress OR inflammation) AND renal',
                  ].map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setQuery(example)}
                      className="rounded-full border border-indigo-200 bg-white px-3 py-2 text-indigo-800 transition active:scale-95 hover:bg-indigo-100"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>

              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-indigo-700">
                {isArabic ? "يدعم PubMed syntax" : "PubMed syntax ready"}
              </span>
            </div>
          </div>
<div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <div>
      <h3 className="text-lg font-bold text-gray-900">
        {isArabic ? "البحوث المحفوظة" : "Saved Searches"}
      </h3>

      <p className="mt-1 text-sm text-gray-600">
        {isArabic
          ? "احفظ كلمات البحث والسنوات للرجوع إليها بسرعة."
          : "Save search terms and year ranges for quick reuse."}
      </p>
    </div>

    <button
      type="button"
      onClick={saveCurrentSearch}
      className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-bold text-white transition active:scale-95 hover:bg-black"
    >
      {isArabic ? "حفظ البحث الحالي" : "Save current search"}
    </button>
  </div>

  {savedSearches.length > 0 && (
    <div className="mt-4 flex flex-wrap gap-2">
      {savedSearches.map((savedSearch) => (
        <div
          key={savedSearch.id}
          className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          <button
            type="button"
            onClick={() => loadSavedSearch(savedSearch)}
            className="font-bold text-blue-700 underline"
            title={savedSearch.createdAt}
          >
            {savedSearch.query} ({savedSearch.fromYear}-{savedSearch.toYear})
          </button>

          <button
            type="button"
            onClick={() => deleteSavedSearch(savedSearch.id)}
            className="rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700 transition active:scale-95 hover:bg-red-100"
          >
            {isArabic ? "حذف" : "Delete"}
          </button>
        </div>
      ))}
    </div>
  )}

  {savedSearches.length === 0 && (
    <p className="mt-3 text-sm text-gray-500">
      {isArabic
        ? "لا توجد بحوث محفوظة حالياً."
        : "No saved searches yet."}
    </p>
  )}
  <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <div>
      <h3 className="text-lg font-bold text-gray-900">
        {isArabic ? "سجل البحث" : "Search History"}
      </h3>

      <p className="mt-1 text-sm text-gray-600">
        {isArabic
          ? "آخر عمليات البحث التي أجريتها يتم حفظها تلقائياً في هذا المتصفح."
          : "Your recent searches are saved automatically in this browser."}
      </p>
    </div>

    {searchHistory.length > 0 && (
      <button
        type="button"
        onClick={clearSearchHistory}
        className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition active:scale-95 hover:bg-red-100"
      >
        {isArabic ? "حذف السجل" : "Clear history"}
      </button>
    )}
  </div>

  {searchHistory.length > 0 && (
    <div className="mt-4 flex flex-wrap gap-2">
      {searchHistory.map((historyItem) => (
  <div
    key={historyItem.id}
    className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
  >
    <button
      type="button"
      onClick={() => loadHistoryItem(historyItem)}
      title={historyItem.searchedAt}
      className="font-bold text-gray-800 underline"
    >
      {historyItem.query} ({historyItem.fromYear}-{historyItem.toYear})
    </button>

    <button
      type="button"
      onClick={() => runHistorySearch(historyItem)}
      className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 transition active:scale-95 hover:bg-blue-100"
    >
      {isArabic ? "بحث الآن" : "Search now"}
    </button>
  </div>
))}
    </div>
  )}

  {searchHistory.length === 0 && (
    <p className="mt-3 text-sm text-gray-500">
      {isArabic ? "لا يوجد سجل بحث حالياً." : "No search history yet."}
    </p>
  )}
</div>
</div>
          {searchMessage && (
            <p className="mt-4 rounded-xl bg-gray-50 p-3 text-sm font-semibold text-gray-700">
              {searchMessage}
            </p>
          )}
{journalCarouselItems.length > 0 && (
  <section className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white p-4">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h3 className="text-xl font-bold text-gray-900">
          {isArabic ? "سلايدر المجلات العلمية" : "Journal Classification Slider"}
        </h3>

        <p className="mt-1 text-sm text-gray-600">
          {isArabic
            ? "استعراض ثابت للمجلات الموجودة في نتائج البحث، ويمكن تحريكه يدوياً بالأسهم."
            : "Manual slider of journals found in the current search results with quartile and indexing status."}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-bold text-gray-700">
          {journalCarouselItems.length} {isArabic ? "مجلة" : "journals"}
        </span>

        <button
          type="button"
          onClick={() => scrollSlider(journalSliderRef, "left")}
          className="rounded-full border border-gray-300 bg-white px-4 py-2 text-lg font-bold text-gray-800 shadow-sm transition active:scale-95 hover:bg-gray-100"
          aria-label={isArabic ? "المجلة السابقة" : "Previous journal"}
        >
          {isArabic ? "→" : "←"}
        </button>

        <button
          type="button"
          onClick={() => scrollSlider(journalSliderRef, "right")}
          className="rounded-full border border-gray-300 bg-white px-4 py-2 text-lg font-bold text-gray-800 shadow-sm transition active:scale-95 hover:bg-gray-100"
          aria-label={isArabic ? "المجلة التالية" : "Next journal"}
        >
          {isArabic ? "←" : "→"}
        </button>
      </div>
    </div>

    <div
      ref={journalSliderRef}
      className="mt-5 flex snap-x snap-mandatory gap-4 overflow-x-hidden scroll-smooth pb-2"
    >
      {journalCarouselItems.map((journal, index) => (
        <div
          key={`${journal.journal}-${index}`}
          className="min-w-[320px] max-w-[320px] snap-start rounded-2xl border border-gray-200 bg-gray-50 p-4 shadow-sm md:min-w-[360px] md:max-w-[360px]"
        >
          <div className="flex items-start justify-between gap-3">
            <h4 className="line-clamp-2 text-base font-bold text-gray-900">
              {journal.journal}
            </h4>

            <span
              className={`shrink-0 rounded-full border px-3 py-1 text-sm font-bold ${getQuartileBadgeClass(
                journal.quartile
              )}`}
            >
              {journal.quartile}
            </span>
          </div>

          <p className="mt-3 text-sm font-semibold text-green-700">
            {journal.indexingStatus}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-700">
            {journal.sjr && (
              <p>
                <strong>SJR:</strong> {journal.sjr}
              </p>
            )}

            {journal.hIndex && (
              <p>
                <strong>H-index:</strong> {journal.hIndex}
              </p>
            )}

            {journal.publisher && (
              <p className="col-span-2 line-clamp-1">
                <strong>{t.publisher}:</strong> {journal.publisher}
              </p>
            )}

            {journal.issn && (
              <p className="col-span-2 line-clamp-1">
                <strong>{t.issn}:</strong> {journal.issn}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  </section>
)}
{articles.length > 0 && (
  <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        <h3 className="text-xl font-bold text-gray-900">
          {isArabic ? "لوحة جودة النتائج" : "Journal Quality Dashboard"}
        </h3>

        <p className="mt-1 text-sm text-gray-600">
          {isArabic
            ? "ملخص سريع لجودة النتائج حسب الربع، DOI، وحالة الفهرسة."
            : "Quick overview of result quality by quartile, DOI availability, and indexing status."}
        </p>
      </div>

      <span className="rounded-full bg-gray-100 px-4 py-2 text-sm font-bold text-gray-700">
        {qualityDashboardStats.total} {isArabic ? "نتيجة" : "results"}
      </span>
    </div>

    <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm font-bold text-gray-500">
          {isArabic ? "كل النتائج" : "Total"}
        </p>
        <p className="mt-2 text-3xl font-bold text-gray-900">
          {qualityDashboardStats.total}
        </p>
      </div>

     <button
  type="button"
  onClick={() => jumpToResultsWithQuartile("Q1")}
  className="clickable-card rounded-2xl border border-green-200 bg-green-50 p-4 text-left"
>
  <p className="text-sm font-bold text-green-700">Q1</p>
  <p className="mt-2 text-3xl font-bold text-green-800">
    {qualityDashboardStats.q1}
  </p>
</button>

<button
  type="button"
  onClick={() => jumpToResultsWithQuartile("Q2")}
  className="clickable-card rounded-2xl border border-blue-200 bg-blue-50 p-4 text-left"
>
  <p className="text-sm font-bold text-blue-700">Q2</p>
  <p className="mt-2 text-3xl font-bold text-blue-800">
    {qualityDashboardStats.q2}
  </p>
</button>

<button
  type="button"
  onClick={() => jumpToResultsWithQuartile("Q3")}
  className="clickable-card rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-left"
>
  <p className="text-sm font-bold text-yellow-700">Q3</p>
  <p className="mt-2 text-3xl font-bold text-yellow-800">
    {qualityDashboardStats.q3}
  </p>
</button>

<button
  type="button"
  onClick={() => jumpToResultsWithQuartile("Q4")}
  className="clickable-card rounded-2xl border border-red-200 bg-red-50 p-4 text-left"
>
  <p className="text-sm font-bold text-red-700">Q4</p>
  <p className="mt-2 text-3xl font-bold text-red-800">
    {qualityDashboardStats.q4}
  </p>
</button>

<button
  type="button"
  onClick={() => jumpToResultsWithQuartile("Not found")}
  className="clickable-card rounded-2xl border border-gray-200 bg-gray-50 p-4 text-left"
>
  <p className="text-sm font-bold text-gray-500">
    {isArabic ? "غير موجود في SCImago" : "Not found"}
  </p>
  <p className="mt-2 text-3xl font-bold text-gray-900">
    {qualityDashboardStats.notFound}
  </p>
</button>

      <button
  type="button"
  onClick={jumpToResultsWithDoi}
  className="clickable-card rounded-2xl border border-purple-200 bg-purple-50 p-4 text-left"
>
  <p className="text-sm font-bold text-purple-700">
    {isArabic ? "تحتوي DOI" : "With DOI"}
  </p>
  <p className="mt-2 text-3xl font-bold text-purple-800">
    {qualityDashboardStats.withDoi}
  </p>
</button>

      <button
  type="button"
  onClick={jumpToResultsWithScimagoIndexed}
  className="clickable-card rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left"
>
  <p className="text-sm font-bold text-emerald-700">
    {isArabic ? "مفهرسة في SCImago" : "SCImago indexed"}
  </p>
  <p className="mt-2 text-3xl font-bold text-emerald-800">
    {qualityDashboardStats.scimagoIndexed}
  </p>
</button>
    </div>
  </section>
)}
{articles.length > 0 && publicationYearStats.items.length > 0 && (
  <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        <h3 className="text-xl font-bold text-gray-900">
          {isArabic ? "تحليل النشر عبر السنوات" : "Publication Trend by Year"}
        </h3>

        <p className="mt-1 text-sm text-gray-600">
          {isArabic
            ? "رسم بياني بسيط يوضح توزيع النتائج الحالية حسب سنة النشر."
            : "A compact visual chart showing how current results are distributed by publication year."}
        </p>
      </div>

      <span className="rounded-full bg-gray-100 px-4 py-2 text-sm font-bold text-gray-700">
        {publicationYearStats.items.length} {isArabic ? "سنة" : "years"}
      </span>
    </div>

    <div className="mt-5 space-y-3">
      {publicationYearStats.items.map((item) => (
        <div key={item.year} className="grid grid-cols-[70px_1fr_50px] items-center gap-3">
          <span className="text-sm font-bold text-gray-700">{item.year}</span>

          <div className="h-4 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-blue-700"
              style={{
                width: `${Math.max(
                  6,
                  Math.round((item.count / publicationYearStats.maxCount) * 100)
                )}%`,
              }}
            />
          </div>

          <span className="text-sm font-bold text-gray-900">{item.count}</span>
        </div>
      ))}
    </div>
  </section>
)}
{activeFilters.length > 0 && (
  <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h3 className="text-lg font-bold text-gray-900">
          {isArabic ? "الفلاتر المفعّلة" : "Active filters"}
        </h3>

        <p className="mt-1 text-sm text-gray-600">
          {isArabic
            ? "هذه الفلاتر مطبقة حالياً على النتائج."
            : "These filters are currently applied to the results."}
        </p>
      </div>

      <button
        type="button"
        onClick={resetFilters}
        className="rounded-xl bg-black px-4 py-2 text-sm font-bold text-white transition active:scale-95 hover:bg-gray-800"
      >
        {isArabic ? "إزالة كل الفلاتر" : "Clear all filters"}
      </button>
    </div>

    <div className="mt-4 flex flex-wrap gap-2">
      {activeFilters.map((filter) => (
        <button
          key={filter.key}
          type="button"
          onClick={filter.clear}
          className="rounded-full border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-800 transition active:scale-95 hover:bg-blue-100"
        >
          {filter.label} ×
        </button>
      ))}
    </div>
  </div>
)}
          {articles.length > 0 && (
            <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
<div className="grid grid-cols-1 gap-4 md:grid-cols-8">
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
                  <button
                    type="button"
                    onClick={loadLibraryArticles}
                    disabled={libraryLoading}
                    className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition active:scale-95 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {libraryLoading
                      ? isArabic
                        ? "جاري التحميل..."
                        : "Loading..."
                      : t.myLibrary}
                  </button>
                </div>
<div>
  <label className="text-sm font-bold text-gray-700">
    {isArabic ? "ترتيب النتائج" : "Sort by"}
  </label>
  <select
    value={sortOption}
    onChange={(event) => setSortOption(event.target.value as SortOption)}
    className="mt-2 w-full rounded-xl border border-gray-300 bg-white p-3"
  >
    {sortOptions.map((option) => (
      <option key={option} value={option}>
        {option}
      </option>
    ))}
  </select>
</div>
<div>
  <label className="text-sm font-bold text-gray-700">
    {isArabic ? "فلترة DOI" : "DOI filter"}
  </label>
  <select
    value={doiFilter}
    onChange={(event) => setDoiFilter(event.target.value as DoiFilter)}
    className="mt-2 w-full rounded-xl border border-gray-300 bg-white p-3"
  >
    {doiFilters.map((filter) => (
      <option key={filter} value={filter}>
        {filter}
      </option>
    ))}
  </select>
</div>
<div>
  <label className="text-sm font-bold text-gray-700">
    {isArabic ? "فلترة باسم المجلة" : "Journal name filter"}
  </label>
  <input
    type="text"
    value={journalFilter}
    onChange={(event) => setJournalFilter(event.target.value)}
    placeholder={isArabic ? "مثال: Medicine" : "Example: Medicine"}
    className="mt-2 w-full rounded-xl border border-gray-300 bg-white p-3"
  />
</div>
<div>
  <label className="text-sm font-bold text-gray-700">
    {isArabic ? "دقة مطابقة SCImago" : "Match confidence"}
  </label>
  <select
    value={matchConfidenceFilter}
    onChange={(event) =>
      setMatchConfidenceFilter(event.target.value as MatchConfidenceFilter)
    }
    className="mt-2 w-full rounded-xl border border-gray-300 bg-white p-3"
  >
    {matchConfidenceFilters.map((filter) => (
      <option key={filter} value={filter}>
        {filter}
      </option>
    ))}
  </select>
</div>
                <div className="md:col-span-2">
                  <label className="text-sm font-bold text-gray-700">
                    {isArabic ? "التصدير" : "Export"}
                  </label>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-bold text-gray-800 transition active:scale-95 hover:bg-gray-50"
                    >
                      {isArabic ? "إعادة ضبط" : "Reset"}
                    </button>

                    <button
                      type="button"
                      onClick={downloadWord}
                      className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white transition active:scale-95 hover:bg-blue-800"
                    >
                      Word
                    </button>

                    <button
                      type="button"
                      onClick={downloadRIS}
                      className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition active:scale-95 hover:bg-emerald-800"
                    >
                      RIS
                    </button>

                    <button
                      type="button"
                      onClick={downloadBibTeX}
                      className="rounded-xl bg-purple-700 px-4 py-3 text-sm font-bold text-white transition active:scale-95 hover:bg-purple-800"
                    >
                      BibTeX
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}


{showLibrary && (
  <section className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h3 className="text-xl font-bold text-gray-900">{t.myLibrary}</h3>
        <p className="mt-1 text-sm text-gray-600">
          {isArabic
            ? "المصادر التي حفظتها تظهر هنا ويمكن حذفها عند الحاجة."
            : "Saved articles appear here and can be removed when needed."}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setShowLibrary(false)}
        className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 transition active:scale-95 hover:bg-gray-50"
      >
        {isArabic ? "إخفاء المكتبة" : "Hide library"}
      </button>
    </div>

    {libraryArticles.length === 0 ? (
      <p className="mt-4 rounded-xl bg-white p-4 text-sm font-semibold text-gray-600">
        {t.libraryEmpty}
      </p>
    ) : (
      <div className="mt-4 space-y-3">
        {libraryArticles.map((article) => {
          const articleId = article.pmid || article.title;

          return (
            <article
              key={articleId}
              className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                    {article.source || "PUBMED"}
                    {article.pmid ? ` · PMID: ${article.pmid}` : ""}
                  </p>

                  <h4 className="mt-2 text-lg font-bold text-gray-900">
                    {article.title}
                  </h4>

                  <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-gray-700 md:grid-cols-2">
                    <p>
                      <strong>{t.journal}:</strong> {article.journal || "Not specified"}
                    </p>
                    <p>
                      <strong>{t.date}:</strong> {article.pubdate || "Not specified"}
                    </p>
                    <p>
                      <strong>{t.quartile}:</strong> {article.quartile || "Not found"}
                    </p>
                    <p>
                      <strong>{t.doi}:</strong> {article.doi || "Not available"}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  {article.sourceUrl && (
                    <a
                      href={article.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl border border-blue-200 px-4 py-2 text-sm font-bold text-blue-700"
                    >
                      {t.openPubMed}
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => deleteArticleFromLibrary(articleId)}
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition active:scale-95 hover:bg-red-100"
                  >
                    {t.deleteFromLibrary}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    )}
  </section>
)}

<div ref={resultsSectionRef} className="mt-6 space-y-4">
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
{article.abstract && (
  <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-gray-700">
    <strong>{isArabic ? "المستخلص:" : "Abstract:"}</strong>{" "}
    {article.abstract}
  </p>
)}
{article.matchConfidence && (
  <div className="mt-3">
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-sm font-bold ${getMatchConfidenceBadgeClass(
        article.matchConfidence
      )}`}
    >
      {isArabic ? "دقة المطابقة: " : "Match confidence: "}
      {article.matchConfidence}
    </span>
  </div>
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

                  <button
                    type="button"
                    onClick={() => summarizeArticle(article)}
                    disabled={Boolean(aiSummaryLoading[article.pmid])}
                    className="rounded-xl bg-indigo-700 px-4 py-2 text-sm font-bold text-white transition active:scale-95 hover:bg-indigo-800 disabled:bg-indigo-300"
                  >
                    {aiSummaryLoading[article.pmid]
                      ? isArabic
                        ? "جاري التلخيص..."
                        : "Summarizing..."
                      : isArabic
                        ? "تلخيص ذكي"
                        : "AI Summary"}
                  </button>

                  <a
                    href={article.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-blue-200 px-4 py-2 text-sm font-bold text-blue-700 transition active:scale-95 hover:bg-blue-50"
                  >
                    {t.openPubMed}
                  </a>
                  <button
  type="button"
  onClick={() => saveArticleToLibrary(article)}
  disabled={
    savingLibraryIds[article.pmid || article.title] ||
    savedLibraryIds[article.pmid || article.title]
  }
  className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 disabled:opacity-60"
>
  {savedLibraryIds[article.pmid || article.title]
    ? t.savedToLibrary
    : savingLibraryIds[article.pmid || article.title]
    ? isArabic
      ? "جاري الحفظ..."
      : "Saving..."
    : t.saveToLibrary}
</button>
                </div>

                {aiSummaryError[article.pmid] && (
                  <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-800">
                    {aiSummaryError[article.pmid]}
                  </div>
                )}

                {aiSummaries[article.pmid] && (
                  <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <h4 className="text-base font-bold text-gray-900">
                        {isArabic ? "الملخص الذكي" : "AI Research Summary"}
                      </h4>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-indigo-700">
                        {isArabic ? "Gemini API" : "Gemini API"}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-gray-700 md:grid-cols-2">
                      <div className="rounded-xl bg-white p-3">
                        <strong>{isArabic ? "الهدف:" : "Objective:"}</strong>
                        <p className="mt-1 leading-6">{aiSummaries[article.pmid].objective}</p>
                      </div>

                      <div className="rounded-xl bg-white p-3">
                        <strong>{isArabic ? "المنهجية:" : "Methodology:"}</strong>
                        <p className="mt-1 leading-6">{aiSummaries[article.pmid].methodology}</p>
                      </div>

                      <div className="rounded-xl bg-white p-3 md:col-span-2">
                        <strong>{isArabic ? "أهم النتائج:" : "Key findings:"}</strong>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                          {aiSummaries[article.pmid].keyFindings.map((finding, findingIndex) => (
                            <li key={`${article.pmid}-finding-${findingIndex}`}>{finding}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-xl bg-white p-3">
                        <strong>{isArabic ? "الخلاصة:" : "Conclusion:"}</strong>
                        <p className="mt-1 leading-6">{aiSummaries[article.pmid].conclusion}</p>
                      </div>

                      <div className="rounded-xl bg-white p-3">
                        <strong>{isArabic ? "القيمة البحثية:" : "Research value:"}</strong>
                        <p className="mt-1 leading-6">{aiSummaries[article.pmid].researchValue}</p>
                      </div>

                      <div className="rounded-xl bg-white p-3 md:col-span-2">
                        <strong>{isArabic ? "ملاحظة/حدود:" : "Limitation note:"}</strong>
                        <p className="mt-1 leading-6">{aiSummaries[article.pmid].limitation}</p>
                      </div>
                    </div>
                  </div>
                )}
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