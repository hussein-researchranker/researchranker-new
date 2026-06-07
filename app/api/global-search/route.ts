import path from "path";
import { readFile } from "fs/promises";

export const runtime = "nodejs";

type GlobalArticle = {
  id: string;
  pmid?: string;
  title: string;
  journal: string;
  pubdate: string;
  authors: string;
  doi: string;
  abstract: string;
  source: string;
  sourceUrl: string;
  pubmedUrl?: string;
  quartile: string;
  indexingStatus: string;
  sjr: string;
  hIndex: string;
  publisher: string;
  issn: string;
  matchConfidence: string;
};

type ScimagoJournal = {
  title: string;
  normalizedTitle: string;
  titleTokens: string[];
  issns: string[];
  quartile: string;
  sjr: string;
  hIndex: string;
  publisher: string;
  categories: string;
};

type CrossrefAuthor = {
  given?: string;
  family?: string;
  name?: string;
};

type CrossrefWork = {
  DOI?: string;
  title?: string[];
  subtitle?: string[];
  abstract?: string;
  author?: CrossrefAuthor[];
  "container-title"?: string[];
  publisher?: string;
  ISSN?: string[];
  "issn-type"?: Array<{
    value?: string;
    type?: string;
  }>;
  issued?: {
    "date-parts"?: number[][];
  };
  published?: {
    "date-parts"?: number[][];
  };
  URL?: string;
  type?: string;
  subject?: string[];
};

type CrossrefListResponse = {
  message?: {
    items?: CrossrefWork[];
  };
};

type CrossrefSingleResponse = {
  message?: CrossrefWork;
};

let scimagoCache: ScimagoJournal[] | null = null;

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getPublicationDate(work: CrossrefWork) {
  const dateParts =
    work.published?.["date-parts"]?.[0] ||
    work.issued?.["date-parts"]?.[0] ||
    [];

  if (!dateParts.length) return "";

  const [year, month, day] = dateParts;

  return [year, month, day].filter(Boolean).join("-");
}

function getAuthors(authors?: CrossrefAuthor[]) {
  if (!authors || authors.length === 0) {
    return "";
  }

  return authors
    .slice(0, 8)
    .map((author) => {
      if (author.name) return cleanText(author.name);

      const given = cleanText(author.given);
      const family = cleanText(author.family);

      return [given, family].filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join(", ");
}

function getYearFromDate(value: string) {
  const match = value.match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

function parseYear(value: string | null, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

function looksLikeDoi(value: string) {
  return /^10\.\d{4,9}\/\S+$/i.test(value.trim());
}

function buildFieldQuery(query: string, field: string) {
  const cleanQuery = cleanText(query);

  if (!cleanQuery || field === "all") {
    return cleanQuery;
  }

  const fieldFilters: Record<string, string> = {
    medicine:
      "medicine clinical patient disease diagnosis therapy hospital healthcare",
    "life-sciences":
      "biology biological cell molecular genetics physiology",
    biochemistry:
      "biochemistry biochemical enzyme protein metabolism biomarker",
    chemistry:
      "chemistry chemical synthesis compound molecule analytical",
    physics:
      "physics physical quantum optics mechanics thermodynamics",
    "computer-science":
      "computer science artificial intelligence machine learning deep learning software algorithm data mining neural network information technology cybersecurity computer vision natural language processing",
    engineering:
      "engineering mechanical electrical civil materials design optimization",
    mathematics:
      "mathematics mathematical statistics probability algebra geometry modeling",
    "environmental-science":
      "environment environmental pollution climate ecosystem sustainability",
    agriculture:
      "agriculture crop soil plant irrigation livestock",
    education:
      "education teaching learning curriculum students classroom pedagogy",
    psychology:
      "psychology psychological behavior cognition mental emotion",
    "social-sciences":
      "social science sociology society community culture",
    business:
      "business management marketing organization leadership",
    economics:
      "economics economic finance market trade development",
    law:
      "law legal legislation regulation policy",
    "arts-humanities":
      "humanities philosophy arts culture ethics",
    linguistics:
      "linguistics language discourse phonology syntax semantics",
    literature:
      "literature literary novel poetry narrative text analysis",
    history:
      "history historical archive civilization heritage",
    geography:
      "geography geographic spatial GIS urban regional",
  };

  const filter = fieldFilters[field];

  if (!filter) {
    return cleanQuery;
  }

  return `${cleanQuery} ${filter}`;
}

function normalizeIssn(value: string) {
  return cleanText(value)
    .replace(/[^0-9xX]/g, "")
    .toUpperCase();
}

function splitIssns(value: string) {
  return cleanText(value)
    .split(/[,; ]+/)
    .map(normalizeIssn)
    .filter(Boolean);
}

function getCrossrefIssns(work: CrossrefWork) {
  const issnsFromIssn = Array.isArray(work.ISSN) ? work.ISSN : [];
  const issnsFromIssnType = Array.isArray(work["issn-type"])
    ? work["issn-type"]
        .map((item) => item.value || "")
        .filter(Boolean)
    : [];

  return Array.from(new Set([...issnsFromIssn, ...issnsFromIssnType]))
    .map(cleanText)
    .filter(Boolean);
}

function normalizeJournalTitle(value: string) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\bthe\b/g, "")
    .replace(/\bjournal of\b/g, "journal")
    .replace(/\binternational journal of\b/g, "international journal")
    .replace(/\bproceedings of\b/g, "proceedings")
    .replace(/\btransactions on\b/g, "transactions")
    .replace(/\bmagazine\b/g, "")
    .replace(/\bletters\b/g, "")
    .replace(/\breview\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTitleTokens(value: string) {
  const stopWords = new Set([
    "and",
    "of",
    "the",
    "in",
    "on",
    "for",
    "to",
    "a",
    "an",
    "journal",
    "international",
  ]);

  return normalizeJournalTitle(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !stopWords.has(token));
}

function tokenSimilarity(a: string[], b: string[]) {
  if (!a.length || !b.length) return 0;

  const aSet = new Set(a);
  const bSet = new Set(b);

  const intersection = [...aSet].filter((token) => bSet.has(token)).length;
  const union = new Set([...aSet, ...bSet]).size;

  return union === 0 ? 0 : intersection / union;
}

function normalizeCrossrefWork(work: CrossrefWork): GlobalArticle | null {
  if (work.type && work.type !== "journal-article") {
    return null;
  }

  const doi = cleanText(work.DOI);
  const title = cleanText(
    [work.title?.[0], work.subtitle?.[0]].filter(Boolean).join(": ")
  );

  if (!title && !doi) {
    return null;
  }

  const journal = cleanText(work["container-title"]?.[0]);
  const pubdate = getPublicationDate(work);
  const sourceUrl = doi ? `https://doi.org/${doi}` : cleanText(work.URL);
  const issns = getCrossrefIssns(work);

  return {
    id: doi || encodeURIComponent(title.toLowerCase()),
    title,
    journal,
    pubdate,
    authors: getAuthors(work.author),
    doi,
    abstract: cleanText(work.abstract),
    source: "Crossref",
    sourceUrl,
    quartile: "Not found",
    indexingStatus: journal
      ? "Crossref metadata / journal quartile requires SCImago matching"
      : "Crossref metadata / source not clearly identified",
    sjr: "",
    hIndex: "",
    publisher: cleanText(work.publisher),
    issn: issns.join(", "),
    matchConfidence: "Crossref metadata",
  };
}

function parseCsvLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === delimiter && !insideQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());

  return values;
}

function detectDelimiter(headerLine: string) {
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  const commaCount = (headerLine.match(/,/g) || []).length;

  return semicolonCount > commaCount ? ";" : ",";
}

function getRowValue(row: Record<string, string>, possibleNames: string[]) {
  for (const name of possibleNames) {
    const value = row[name];

    if (value) {
      return cleanText(value);
    }
  }

  return "";
}

function extractQuartile(row: Record<string, string>) {
  const directQuartile = getRowValue(row, [
    "SJR Best Quartile",
    "Best Quartile",
    "Quartile",
    "quartile",
  ]);

  if (/^Q[1-4]$/i.test(directQuartile)) {
    return directQuartile.toUpperCase();
  }

  const categories = getRowValue(row, ["Categories", "categories"]);
  const match = categories.match(/\bQ[1-4]\b/i);

  return match ? match[0].toUpperCase() : "Not found";
}

async function loadScimagoJournals() {
  if (scimagoCache) {
    return scimagoCache;
  }

  const filePath = path.join(process.cwd(), "public", "scimagojr.csv");
  const fileContent = await readFile(filePath, "utf8");

  const lines = fileContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    scimagoCache = [];
    return scimagoCache;
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map((header) =>
    cleanText(header).replace(/^\uFEFF/, "")
  );

  const journals: ScimagoJournal[] = lines
    .slice(1)
    .map((line) => {
      const values = parseCsvLine(line, delimiter);
      const row: Record<string, string> = {};

      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });

      const title = getRowValue(row, ["Title", "title", "Journal", "journal"]);
      const issn = getRowValue(row, ["Issn", "ISSN", "issn"]);
      const quartile = extractQuartile(row);

      if (!title && !issn) {
        return null;
      }

      return {
        title,
        normalizedTitle: normalizeJournalTitle(title),
        titleTokens: getTitleTokens(title),
        issns: splitIssns(issn),
        quartile,
        sjr: getRowValue(row, ["SJR", "sjr"]),
        hIndex: getRowValue(row, ["H index", "H Index", "hIndex"]),
        publisher: getRowValue(row, ["Publisher", "publisher"]),
        categories: getRowValue(row, ["Categories", "categories"]),
      };
    })
    .filter((journal): journal is ScimagoJournal => Boolean(journal));

  scimagoCache = journals;

  return scimagoCache;
}

function findScimagoMatch(article: GlobalArticle, journals: ScimagoJournal[]) {
  const articleIssns = splitIssns(article.issn);

  if (articleIssns.length > 0) {
    const issnMatch = journals.find((journal) =>
      journal.issns.some((journalIssn) => articleIssns.includes(journalIssn))
    );

    if (issnMatch) {
      return {
        journal: issnMatch,
        confidence: "ISSN exact match",
      };
    }
  }

  const articleJournalTitle = normalizeJournalTitle(article.journal);

  if (!articleJournalTitle) {
    return null;
  }

  const exactTitleMatch = journals.find(
    (journal) => journal.normalizedTitle === articleJournalTitle
  );

  if (exactTitleMatch) {
    return {
      journal: exactTitleMatch,
      confidence: "Journal title exact match",
    };
  }

  const articleTokens = getTitleTokens(article.journal);

  let bestMatch: {
    journal: ScimagoJournal;
    score: number;
  } | null = null;

  for (const journal of journals) {
    if (!journal.normalizedTitle || journal.normalizedTitle.length < 6) {
      continue;
    }

    if (
      journal.normalizedTitle.includes(articleJournalTitle) ||
      articleJournalTitle.includes(journal.normalizedTitle)
    ) {
      return {
        journal,
        confidence: "Journal title partial match",
      };
    }

    const score = tokenSimilarity(articleTokens, journal.titleTokens);

    if (score >= 0.72 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = {
        journal,
        score,
      };
    }
  }

  if (bestMatch) {
    return {
      journal: bestMatch.journal,
      confidence: `Journal title token match (${bestMatch.score.toFixed(2)})`,
    };
  }

  return null;
}

function enrichWithScimago(
  article: GlobalArticle,
  journals: ScimagoJournal[]
): GlobalArticle {
  const match = findScimagoMatch(article, journals);

  if (!match) {
    return article;
  }

  return {
    ...article,
    quartile: match.journal.quartile || article.quartile,
    sjr: match.journal.sjr || article.sjr,
    hIndex: match.journal.hIndex || article.hIndex,
    publisher: match.journal.publisher || article.publisher,
    indexingStatus:
      match.journal.quartile && match.journal.quartile !== "Not found"
        ? `SCImago indexed / ${match.journal.quartile}`
        : "SCImago indexed / quartile not clearly found",
    matchConfidence: match.confidence,
  };
}

async function fetchCrossrefByDoi(doi: string) {
  const response = await fetch(
    `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "ResearchRanker/1.0 (mailto:husseinjk40@gmail.com)",
      },
      next: {
        revalidate: 60 * 60,
      },
    }
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as CrossrefSingleResponse;

  return data.message || null;
}

async function fetchCrossrefWorks(
  fieldAwareQuery: string,
  fromYear: number,
  toYear: number,
  maxResults: number
) {
  const params = new URLSearchParams({
    "query.bibliographic": fieldAwareQuery,
    rows: String(maxResults),
    select:
      "DOI,title,subtitle,author,container-title,publisher,ISSN,issn-type,issued,published,URL,type,subject,abstract",
    sort: "relevance",
    order: "desc",
    filter: `from-pub-date:${fromYear},until-pub-date:${toYear},type:journal-article`,
  });

  const response = await fetch(`https://api.crossref.org/works?${params}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ResearchRanker/1.0 (mailto:husseinjk40@gmail.com)",
    },
    next: {
      revalidate: 60 * 30,
    },
  });

  if (!response.ok) {
    throw new Error("Crossref search failed.");
  }

  const data = (await response.json()) as CrossrefListResponse;

  return data.message?.items || [];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const query = cleanText(
      searchParams.get("query") || searchParams.get("q") || ""
    );
    const field = cleanText(searchParams.get("field") || "all");
    const currentYear = new Date().getFullYear();
    const fromYear = parseYear(searchParams.get("fromYear"), 1990);
    const toYear = parseYear(searchParams.get("toYear"), currentYear);
    const maxResults = Math.min(
      Math.max(Number(searchParams.get("maxResults") || "50"), 1),
      100
    );

    if (!query) {
      return Response.json(
        { error: "Missing query parameter." },
        { status: 400 }
      );
    }

    const scimagoJournals = await loadScimagoJournals();

    const works = looksLikeDoi(query)
      ? [await fetchCrossrefByDoi(query)]
      : await fetchCrossrefWorks(
          buildFieldQuery(query, field),
          fromYear,
          toYear,
          maxResults
        );

    const articles = works
      .filter((work): work is CrossrefWork => Boolean(work))
      .map(normalizeCrossrefWork)
      .filter((article): article is GlobalArticle => Boolean(article))
      .map((article) => enrichWithScimago(article, scimagoJournals))
      .filter((article) => {
        const year = getYearFromDate(article.pubdate);

        if (!year) return true;

        return year >= fromYear && year <= toYear;
      });

    return Response.json(articles);
  } catch (error) {
    console.error("Global search route error:", error);

    return Response.json(
      { error: "Global search failed because of a server error." },
      { status: 500 }
    );
  }
}