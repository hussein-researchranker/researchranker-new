import path from "path";
import { readFile } from "fs/promises";
import { auth } from "@clerk/nextjs/server";
import { checkRateLimit } from "@/lib/rate-limit";

type MatchConfidence =
  | "ISSN exact match"
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
  abstract: string;
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
const DEFAULT_MAX_RESULTS = 50;
const MAX_RESULTS_CAP = 100;
const MAX_QUERY_CHARS = 500;
const PUBMED_TIMEOUT_MS = 12_000;
const SEARCH_LIMIT_PER_MINUTE = 20;

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

function normalizeIssn(value: string) {
  return cleanText(value)
    .replace(/[^0-9xX]/g, "")
    .toUpperCase();
}

function splitIssns(value: string) {
  return cleanText(value)
    .split(/[,; ]+/)
    .map(normalizeIssn)
    .filter((value) => value.length === 8);
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

  const filePath = path.join(process.cwd(), "data", "scimagojr.csv");
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
  articleIssns: string[],
  scimagoJournals: ScimagoJournal[]
): {
  journal: ScimagoJournal | null;
  confidence: MatchConfidence;
} {
  const normalizedArticleIssns = articleIssns
    .map(normalizeIssn)
    .filter((value) => value.length === 8);

  if (normalizedArticleIssns.length > 0) {
    const issnMatch = scimagoJournals.find((journal) =>
      splitIssns(journal.issn).some((issn) =>
        normalizedArticleIssns.includes(issn)
      )
    );

    if (issnMatch) {
      return {
        journal: issnMatch,
        confidence: "ISSN exact match",
      };
    }
  }

  const normalizedJournal = normalizeTitle(journalName);

  if (!normalizedJournal) {
    return {
      journal: null,
      confidence: "Not matched",
    };
  }

  const exactMatch = scimagoJournals.find(
    (scimagoJournal) => scimagoJournal.normalizedTitle === normalizedJournal
  );

  if (exactMatch) {
    return {
      journal: exactMatch,
      confidence: "Exact title match",
    };
  }

  return {
    journal: null,
    confidence: "Not matched",
  };
}

function buildIndexingStatus(match: ScimagoJournal | null, source: string) {
  if (match?.quartile) {
    return `SCImago Indexed - ${match.quartile}`;
  }

  if (match) {
    return "Found in SCImago - quartile not available";
  }

  if (source === "PubMed") {
    return "PubMed result - journal not verified in SCImago by ISSN";
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

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripXmlTags(value: string) {
  return decodeXml(value.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function isTimeoutError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

async function fetchPubMedAbstracts(ids: string[]) {
  const abstractByPmid: Record<string, string> = {};

  if (ids.length === 0) {
    return abstractByPmid;
  }

  const fetchUrl = new URL(`${PUBMED_BASE_URL}/efetch.fcgi`);
  fetchUrl.searchParams.set("db", "pubmed");
  fetchUrl.searchParams.set("id", ids.join(","));
  fetchUrl.searchParams.set("retmode", "xml");

  const fetchResponse = await fetch(fetchUrl.toString(), {
    next: { revalidate: 60 * 60 },
    signal: AbortSignal.timeout(PUBMED_TIMEOUT_MS),
  });

  if (!fetchResponse.ok) {
    return abstractByPmid;
  }

  const xml = await fetchResponse.text();
  const articleBlocks =
    xml.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) || [];

  articleBlocks.forEach((block) => {
    const pmidMatch = block.match(/<PMID[^>]*>([\s\S]*?)<\/PMID>/);
    const pmid = cleanText(stripXmlTags(pmidMatch?.[1] || ""));

    if (!pmid) {
      return;
    }

    const abstractParts = Array.from(
      block.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)
    ).map((match) => stripXmlTags(match[1]));

    abstractByPmid[pmid] = cleanText(abstractParts.filter(Boolean).join(" "));
  });

  return abstractByPmid;
}

function applyFieldFilter(query: string, field: string) {
  const cleanQuery = query.trim();

  if (!cleanQuery || field === "all") {
    return cleanQuery;
  }

  const fieldFilters: Record<string, string> = {
    medicine:
      "(medicine OR clinical OR patient OR disease OR diagnosis OR therapy OR hospital OR healthcare)",
    "life-sciences":
      "(biology OR biological OR cell OR molecular OR genetics OR physiology)",
    biochemistry:
      "(biochemistry OR biochemical OR enzyme OR protein OR metabolism OR biomarker)",
    chemistry:
      "(chemistry OR chemical OR synthesis OR compound OR molecule OR analytical)",
    physics:
      "(physics OR physical OR quantum OR optics OR mechanics OR thermodynamics)",
    "computer-science":
      "(computer science OR artificial intelligence OR machine learning OR deep learning OR software OR algorithm OR data mining OR neural network)",
    engineering:
      "(engineering OR mechanical OR electrical OR civil OR materials OR design OR optimization)",
    mathematics:
      "(mathematics OR mathematical OR statistics OR probability OR algebra OR geometry OR modeling)",
    "environmental-science":
      "(environment OR environmental OR pollution OR climate OR ecosystem OR sustainability)",
    agriculture:
      "(agriculture OR crop OR soil OR plant OR irrigation OR livestock)",
    education:
      "(education OR teaching OR learning OR curriculum OR students OR classroom OR pedagogy)",
    psychology:
      "(psychology OR psychological OR behavior OR cognition OR mental OR emotion)",
    "social-sciences":
      "(social science OR sociology OR society OR community OR culture)",
    business:
      "(business OR management OR marketing OR organization OR leadership)",
    economics:
      "(economics OR economic OR finance OR market OR trade OR development)",
    law: "(law OR legal OR legislation OR regulation OR policy)",
    "arts-humanities":
      "(humanities OR philosophy OR arts OR culture OR ethics)",
    linguistics:
      "(linguistics OR language OR discourse OR phonology OR syntax OR semantics)",
    literature:
      "(literature OR literary OR novel OR poetry OR narrative OR text analysis)",
    history:
      "(history OR historical OR archive OR civilization OR heritage)",
    geography:
      "(geography OR geographic OR spatial OR GIS OR urban OR regional)",
  };

  const filter = fieldFilters[field];

  if (!filter) {
    return cleanQuery;
  }

  return `(${cleanQuery}) AND ${filter}`;
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
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: "You must sign in to search PubMed." },
        { status: 401 }
      );
    }

    const rateLimit = await checkRateLimit({
      key: `pubmed-search:${userId}`,
      limit: SEARCH_LIMIT_PER_MINUTE,
      windowSeconds: 60,
    });

    if (!rateLimit.success) {
      return Response.json(
        {
          error: "Search rate limit reached. Please try again shortly.",
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    const { searchParams } = new URL(request.url);

    const query = cleanText(searchParams.get("query")).slice(
      0,
      MAX_QUERY_CHARS
    );
    const field = cleanText(searchParams.get("field") || "all");
    const fromYear = cleanText(searchParams.get("fromYear") || "2020");
    const toYear = cleanText(
      searchParams.get("toYear") || new Date().getFullYear()
    );
    const rawMaxResults = Number(
      searchParams.get("maxResults") || DEFAULT_MAX_RESULTS
    );
    const maxResults = Number.isFinite(rawMaxResults)
      ? Math.min(Math.max(rawMaxResults, 1), MAX_RESULTS_CAP)
      : DEFAULT_MAX_RESULTS;

    if (!query) {
      return Response.json(
        { error: "Missing query parameter." },
        { status: 400 }
      );
    }

    const scimagoJournals = await loadScimagoData();
    const fieldFilteredQuery = applyFieldFilter(query, field);
    const pubmedQuery = buildPubMedQuery(
      fieldFilteredQuery,
      fromYear,
      toYear
    );

    const searchUrl = new URL(`${PUBMED_BASE_URL}/esearch.fcgi`);
    searchUrl.searchParams.set("db", "pubmed");
    searchUrl.searchParams.set("term", pubmedQuery);
    searchUrl.searchParams.set("retmode", "json");
    searchUrl.searchParams.set("retmax", String(maxResults));
    searchUrl.searchParams.set("sort", "pub date");

    const searchResponse = await fetch(searchUrl.toString(), {
      next: { revalidate: 60 * 30 },
      signal: AbortSignal.timeout(PUBMED_TIMEOUT_MS),
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
      signal: AbortSignal.timeout(PUBMED_TIMEOUT_MS),
    });

    if (!summaryResponse.ok) {
      throw new Error("PubMed summary request failed.");
    }

    const summaryData = await summaryResponse.json();
    const result = summaryData?.result || {};
    const abstractByPmid = await fetchPubMedAbstracts(ids);

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
          issn?: string;
          essn?: string;
        };

        const pmid = cleanText(record.uid);
        const journal =
          cleanText(record.fulljournalname || record.source) ||
          "Unknown journal";
        const articleIssns = [record.issn, record.essn]
          .map((value) => cleanText(value))
          .filter(Boolean);

        const scimagoMatchResult = matchScimagoJournal(
          journal,
          articleIssns,
          scimagoJournals
        );
        const scimagoMatch = scimagoMatchResult.journal;
        const verifiedByIssn =
          scimagoMatchResult.confidence === "ISSN exact match";

        return {
          pmid,
          title: cleanText(record.title) || "No title available",
          journal,
          pubdate: cleanText(record.pubdate) || "No date available",
          authors: getAuthors(article),
          doi: getDoi(article),
          source: "PubMed",
          sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
          abstract: abstractByPmid[pmid] || "",
          quartile: verifiedByIssn
            ? scimagoMatch?.quartile || "Not found"
            : "Not found",
          indexingStatus: verifiedByIssn
            ? buildIndexingStatus(scimagoMatch, "PubMed")
            : scimagoMatch
              ? "SCImago title candidate only - quartile not verified by ISSN"
              : buildIndexingStatus(null, "PubMed"),
          sjr: verifiedByIssn ? scimagoMatch?.sjr || "" : "",
          hIndex: verifiedByIssn ? scimagoMatch?.hIndex || "" : "",
          publisher: verifiedByIssn ? scimagoMatch?.publisher || "" : "",
          issn: articleIssns.join(", "),
          matchConfidence: scimagoMatchResult.confidence,
        };
      });

    return Response.json(articles);
  } catch (error) {
    console.error("Search API error:", error);

    if (isTimeoutError(error)) {
      return Response.json(
        { error: "PubMed search timed out. Please try again." },
        { status: 504 }
      );
    }

    return Response.json({ error: "Search failed." }, { status: 500 });
  }
}
