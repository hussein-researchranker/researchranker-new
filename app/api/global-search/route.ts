import { auth } from "@clerk/nextjs/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { prepareSearchQuery } from "@/lib/search-query";
import { GET as runGlobalSearch } from "./core";

export const runtime = "nodejs";

const GLOBAL_SEARCH_LIMIT_PER_MINUTE = 15;
const MAX_QUERY_CHARS = 500;
const MAX_RESULTS = 50;
const MIN_YEAR = 1900;
const GLOBAL_SEARCH_TIMEOUT_MS = 25_000;
const OPENALEX_TIMEOUT_MS = 10_000;

type OpenAlexWork = {
  id?: string;
  doi?: string;
  title?: string;
  publication_year?: number;
  publication_date?: string;
  authorships?: Array<{
    author?: {
      display_name?: string;
    };
  }>;
  primary_location?: {
    landing_page_url?: string;
    pdf_url?: string;
    source?: {
      display_name?: string;
      issn_l?: string;
      issn?: string[];
      host_organization_name?: string;
    } | null;
  } | null;
  open_access?: {
    oa_url?: string;
  };
};

type OpenAlexResponse = {
  results?: OpenAlexWork[];
};

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parseInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function normalizeDoi(value: string) {
  return cleanText(value)
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi\s*:\s*/i, "")
    .replace(/[.,;]+$/g, "")
    .trim();
}

function normalizeOpenAlexWork(work: OpenAlexWork, isDoiSearch: boolean) {
  const doi = normalizeDoi(work.doi || "");
  const source = work.primary_location?.source;
  const sourceUrl =
    cleanText(work.primary_location?.landing_page_url) ||
    cleanText(work.primary_location?.pdf_url) ||
    cleanText(work.open_access?.oa_url) ||
    (doi ? `https://doi.org/${doi}` : cleanText(work.id));

  const authors = (work.authorships || [])
    .map((authorship) => cleanText(authorship.author?.display_name))
    .filter(Boolean)
    .slice(0, 8)
    .join(", ");

  const issns = [
    cleanText(source?.issn_l),
    ...(Array.isArray(source?.issn) ? source?.issn || [] : []),
  ].filter(Boolean);

  return {
    id: doi || cleanText(work.id) || encodeURIComponent(cleanText(work.title)),
    title: cleanText(work.title) || "Untitled work",
    journal: cleanText(source?.display_name),
    pubdate:
      cleanText(work.publication_date) ||
      (work.publication_year ? String(work.publication_year) : ""),
    authors,
    doi,
    abstract: "",
    source: "OpenAlex",
    sourceUrl,
    quartile: "Not found",
    indexingStatus: "OpenAlex metadata / SCImago quartile not yet verified",
    sjr: "",
    hIndex: "",
    publisher: cleanText(source?.host_organization_name),
    issn: Array.from(new Set(issns)).join(", "),
    matchConfidence: isDoiSearch
      ? "OpenAlex DOI exact match"
      : "OpenAlex relevance search",
  };
}

async function fetchOpenAlexFallback(options: {
  query: string;
  doi: string;
  fromYear: number;
  toYear: number;
  maxResults: number;
}) {
  const params = new URLSearchParams();
  const apiKey = process.env.OPENALEX_API_KEY;

  if (apiKey) {
    params.set("api_key", apiKey);
  }

  if (options.doi) {
    params.set("filter", `doi:${options.doi}`);
    params.set("include_xpac", "true");
    params.set("per_page", "5");
  } else {
    params.set("search", options.query);
    params.set(
      "filter",
      `publication_year:${options.fromYear}-${options.toYear},type:article`
    );
    params.set("per_page", String(Math.min(options.maxResults, 25)));
    params.set("sort", "relevance_score:desc");
  }

  try {
    const response = await fetch(`https://api.openalex.org/works?${params}`, {
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(OPENALEX_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as OpenAlexResponse;

    return (data.results || [])
      .map((work) => normalizeOpenAlexWork(work, Boolean(options.doi)))
      .filter((work) => Boolean(work.title || work.doi));
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: "You must sign in to use global search." },
        { status: 401 }
      );
    }

    const rateLimit = await checkRateLimit({
      key: `global-search:${userId}`,
      limit: GLOBAL_SEARCH_LIMIT_PER_MINUTE,
      windowSeconds: 60,
    });

    if (!rateLimit.success) {
      return Response.json(
        {
          error: "Global search rate limit reached. Please try again shortly.",
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

    const url = new URL(request.url);
    const rawQuery = cleanText(
      url.searchParams.get("query") || url.searchParams.get("q") || ""
    );

    if (!rawQuery) {
      return Response.json(
        { error: "Missing query parameter." },
        { status: 400 }
      );
    }

    if (rawQuery.length > MAX_QUERY_CHARS) {
      return Response.json(
        {
          error: `Query is too long. Maximum length is ${MAX_QUERY_CHARS} characters.`,
        },
        { status: 400 }
      );
    }

    const currentYear = new Date().getFullYear();
    let fromYear = parseInteger(url.searchParams.get("fromYear"), 1990);
    let toYear = parseInteger(url.searchParams.get("toYear"), currentYear);

    if (
      fromYear < MIN_YEAR ||
      toYear > currentYear + 1 ||
      fromYear > toYear
    ) {
      return Response.json(
        { error: "Invalid publication year range." },
        { status: 400 }
      );
    }

    const requestedMaxResults = parseInteger(
      url.searchParams.get("maxResults"),
      MAX_RESULTS
    );
    const maxResults = Math.min(
      Math.max(requestedMaxResults, 1),
      MAX_RESULTS
    );

    const selectedField = cleanText(url.searchParams.get("field") || "all");
    const prepared = await prepareSearchQuery(rawQuery, selectedField);

    if (prepared.isDoi) {
      fromYear = MIN_YEAR;
      toYear = currentYear + 1;
    }

    url.searchParams.set("query", prepared.query);
    url.searchParams.delete("q");
    url.searchParams.set("field", prepared.field);
    url.searchParams.set("fromYear", String(fromYear));
    url.searchParams.set("toYear", String(toYear));
    url.searchParams.set("maxResults", String(maxResults));

    const sanitizedRequest = new Request(url.toString(), {
      method: "GET",
      headers: request.headers,
    });

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const timeoutResponse = new Promise<Response>((resolve) => {
      timeoutId = setTimeout(() => {
        resolve(
          Response.json(
            { error: "Global search timed out. Please try again." },
            { status: 504 }
          )
        );
      }, GLOBAL_SEARCH_TIMEOUT_MS);
    });

    const response = await Promise.race([
      runGlobalSearch(sanitizedRequest),
      timeoutResponse,
    ]);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      return response;
    }

    const responseData = await response.clone().json().catch(() => null);

    if (Array.isArray(responseData) && responseData.length === 0) {
      const fallbackResults = await fetchOpenAlexFallback({
        query: prepared.query,
        doi: prepared.isDoi ? prepared.query : "",
        fromYear,
        toYear,
        maxResults,
      });

      if (fallbackResults.length > 0) {
        return Response.json(fallbackResults, {
          headers: prepared.translatedFromArabic
            ? { "X-ResearchRanker-Translated-Query": "1" }
            : undefined,
        });
      }
    }

    return response;
  } catch (error) {
    console.error("Global search security wrapper error:", error);

    return Response.json(
      { error: "Global search failed because of a server error." },
      { status: 500 }
    );
  }
}
