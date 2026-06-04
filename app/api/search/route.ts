import path from "path";
import { readFile } from "fs/promises";

type MatchConfidence =
  | "Exact title match"
  | "Approximate title match"
  | "Not matched";

type PubMedArticle = {
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
  matchConfidence: MatchConfidence;
};

type ScimagoJournal = {
  title: string;
  normalizedTitle: string;
  issn: string;
  quartile: string;
  sjr: string;
  hIndex: string;
  publisher: string;
};

const PUBMED_BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const DEFAULT_MAX_RESULTS = 20;

let scimagoCache: ScimagoJournal[] | null = null;

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTitle(value: string) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\bthe\b/g, "")
    .replace(/\bjournal of\b/g, "")
    .replace(/\bamerican journal of\b/g, "")
    .replace(/\binternational journal of\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === ";" && !insideQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());

  return cells.map((cell) => cell.replace(/^"|"$/g, "").trim());
}

function findColumn(headers: string[], candidates: string[]) {
  const normalizedHeaders = headers.map((header) =>
    header.toLowerCase().replace(/[^a-z0-9]+/g, "")
  );

  for (const candidate of candidates) {
    const normalizedCandidate = candidate
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");

    const index = normalizedHeaders.findIndex(
      (header) => header === normalizedCandidate
    );

    if (index !== -1) {
      return index;
    }
  }

  return -1;
}

async function loadScimagoData() {
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

  const headers = parseCsvLine(lines[0]);

  const titleIndex = findColumn(headers, ["Title", "Source title"]);
  const issnIndex = findColumn(headers, ["Issn", "ISSN"]);
  const quartileIndex = findColumn(headers, [
    "SJR Best Quartile",
    "Best Quartile",
    "Quartile",
  ]);
  const sjrIndex = findColumn(headers, ["SJR"]);
  const hIndexIndex = findColumn(headers, ["H index", "H-index", "Hindex"]);
  const publisherIndex = findColumn(headers, ["Publisher"]);

  const journals: ScimagoJournal[] = [];

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const title = cleanText(cells[titleIndex]);

    if (!title) {
      continue;
    }

    journals.push({
      title,
      normalizedTitle: normalizeTitle(title),
      issn: issnIndex >= 0 ? cleanText(cells[issnIndex]) : "",
      quartile: quartileIndex >= 0 ? cleanText(cells[quartileIndex]) : "",
      sjr: sjrIndex >= 0 ? cleanText(cells[sjrIndex]) : "",
      hIndex: hIndexIndex >= 0 ? cleanText(cells[hIndexIndex]) : "",
      publisher: publisherIndex >= 0 ? cleanText(cells[publisherIndex]) : "",
    });
  }

  scimagoCache = journals;
  return scimagoCache;
}

function matchScimagoJournal(
  journalName: string,
  scimagoJournals: ScimagoJournal[]
): {
  journal: ScimagoJournal | null;
  confidence: MatchConfidence;
} {
  const normalizedJournal = normalizeTitle(journalName);

  if (!normalizedJournal) {
    return {
      journal: null,
      confidence: "Not matched",
    };
  }

  const exactMatch = scimagoJournals.find(
    (scimagoJournal: ScimagoJournal) =>
      scimagoJournal.normalizedTitle === normalizedJournal
  );

  if (exactMatch) {
    return {
      journal: exactMatch,
      confidence: "Exact title match",
    };
  }

  const partialMatch = scimagoJournals.find(
    (scimagoJournal: ScimagoJournal) => {
      if (!scimagoJournal.normalizedTitle) {
        return false;
      }

      return (
        scimagoJournal.normalizedTitle.includes(normalizedJournal) ||
        normalizedJournal.includes(scimagoJournal.normalizedTitle)
      );
    }
  );

  if (partialMatch) {
    return {
      journal: partialMatch,
      confidence: "Approximate title match",
    };
  }

  return {
    journal: null,
    confidence: "Not matched",
  };
}
function buildIndexingStatus(
  match: ScimagoJournal | null,
  source: string
) {
  if (match?.quartile) {
    return `SCImago Indexed - ${match.quartile}`;
  }

  if (match) {
    return "Found in SCImago - quartile not available";
  }

  if (source === "PubMed") {
    return "PubMed result - journal not found in SCImago";
  }

  return "Unknown / check manually";
}

function getDoi(article: unknown) {
  const record = article as {
    articleids?: Array<{ idtype?: string; value?: string }>;
  };

  const articleIds = Array.isArray(record.articleids)
    ? record.articleids
    : [];

  const doiItem = articleIds.find((item) => item.idtype === "doi");

  return cleanText(doiItem?.value);
}

function getAuthors(article: unknown) {
  const record = article as {
    authors?: Array<{ name?: string }>;
  };

  const authors = Array.isArray(record.authors) ? record.authors : [];

  return authors
    .slice(0, 6)
    .map((author) => cleanText(author.name))
    .filter(Boolean)
    .join(", ");
}

function buildPubMedQuery(query: string, fromYear: string, toYear: string) {
  const cleanQuery = cleanText(query);
  const startYear = /^\d{4}$/.test(fromYear) ? fromYear : "2020";
  const endYear = /^\d{4}$/.test(toYear)
    ? toYear
    : new Date().getFullYear().toString();

  return `${cleanQuery} AND ("${startYear}"[Date - Publication] : "${endYear}"[Date - Publication])`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const query = cleanText(searchParams.get("query"));
    const fromYear = cleanText(searchParams.get("fromYear") || "2020");
    const toYear = cleanText(
      searchParams.get("toYear") || new Date().getFullYear()
    );
    const maxResults = Number(
      searchParams.get("maxResults") || DEFAULT_MAX_RESULTS
    );

    if (!query) {
      return Response.json(
        { error: "Missing query parameter." },
        { status: 400 }
      );
    }

    const scimagoJournals = await loadScimagoData();
    const pubmedQuery = buildPubMedQuery(query, fromYear, toYear);

    const searchUrl = new URL(`${PUBMED_BASE_URL}/esearch.fcgi`);
    searchUrl.searchParams.set("db", "pubmed");
    searchUrl.searchParams.set("term", pubmedQuery);
    searchUrl.searchParams.set("retmode", "json");
    searchUrl.searchParams.set(
      "retmax",
      String(Math.min(Math.max(maxResults, 1), 50))
    );
    searchUrl.searchParams.set("sort", "pub date");

    const searchResponse = await fetch(searchUrl.toString(), {
      next: { revalidate: 60 * 30 },
    });

    if (!searchResponse.ok) {
      throw new Error("PubMed search request failed.");
    }

    const searchData = await searchResponse.json();
    const ids: string[] = searchData?.esearchresult?.idlist || [];

    if (ids.length === 0) {
      return Response.json([]);
    }

    const summaryUrl = new URL(`${PUBMED_BASE_URL}/esummary.fcgi`);
    summaryUrl.searchParams.set("db", "pubmed");
    summaryUrl.searchParams.set("id", ids.join(","));
    summaryUrl.searchParams.set("retmode", "json");

    const summaryResponse = await fetch(summaryUrl.toString(), {
      next: { revalidate: 60 * 30 },
    });

    if (!summaryResponse.ok) {
      throw new Error("PubMed summary request failed.");
    }

    const summaryData = await summaryResponse.json();
    const result = summaryData?.result || {};

    const articles: PubMedArticle[] = ids
      .map((id) => result[id])
      .filter(Boolean)
      .map((article: unknown) => {
        const record = article as {
          uid?: string;
          title?: string;
          fulljournalname?: string;
          source?: string;
          pubdate?: string;
        };

        const pmid = cleanText(record.uid);
        const journal =
          cleanText(record.fulljournalname || record.source) ||
          "Unknown journal";

const scimagoMatchResult = matchScimagoJournal(journal, scimagoJournals);
const scimagoMatch = scimagoMatchResult.journal;

return {
  pmid,
  title: cleanText(record.title) || "No title available",
  journal,
  pubdate: cleanText(record.pubdate) || "No date available",
  authors: getAuthors(article),
  doi: getDoi(article),
  source: "PubMed",
  sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
  quartile: scimagoMatch?.quartile || "Not found",
  indexingStatus: buildIndexingStatus(scimagoMatch, "PubMed"),
  sjr: scimagoMatch?.sjr || "",
  hIndex: scimagoMatch?.hIndex || "",
  publisher: scimagoMatch?.publisher || "",
  issn: scimagoMatch?.issn || "",
  matchConfidence: scimagoMatchResult.confidence,
};
      });

    return Response.json(articles);
  } catch (error) {
    console.error("Search API error:", error);

    return Response.json({ error: "Search failed." }, { status: 500 });
  }
}