import { createHash } from "node:crypto";

export const SEARCH_RATE_LIMIT = 30;
export const SEARCH_RATE_WINDOW_SECONDS = 10 * 60;
export const MAX_SEARCH_RESULTS = 50;
export const MAX_OPENALEX_ENRICHMENTS = 12;
export const MAX_SEARCH_QUERY_CHARS = 500;
export const UPSTREAM_TIMEOUT_MS = 12_000;

const ALLOWED_FIELDS = new Set([
  "all",
  "medicine",
  "life-sciences",
  "biochemistry",
  "chemistry",
  "physics",
  "computer-science",
  "engineering",
  "mathematics",
  "environmental-science",
  "agriculture",
  "education",
  "psychology",
  "social-sciences",
  "business",
  "economics",
  "law",
  "arts-humanities",
  "linguistics",
  "literature",
  "history",
  "geography",
]);

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function normalizeSearchQuery(value) {
  const query = clean(value);

  return {
    query,
    tooLong: query.length > MAX_SEARCH_QUERY_CHARS,
  };
}

export function normalizeSearchField(value) {
  const field = clean(value).toLowerCase();
  return ALLOWED_FIELDS.has(field) ? field : "all";
}

export function parseSearchResultLimit(value, fallback = MAX_SEARCH_RESULTS) {
  const safeFallback = Math.min(
    Math.max(Number.isFinite(fallback) ? Math.floor(fallback) : MAX_SEARCH_RESULTS, 1),
    MAX_SEARCH_RESULTS
  );
  const raw = clean(value);

  if (!raw) {
    return safeFallback;
  }

  const parsed = Number(raw);

  if (!Number.isFinite(parsed)) {
    return safeFallback;
  }

  return Math.min(Math.max(Math.floor(parsed), 1), MAX_SEARCH_RESULTS);
}

export function parseSearchYearRange(fromValue, toValue, currentYear = new Date().getFullYear()) {
  const upperBound = Math.max(1900, Math.floor(currentYear) + 1);

  function parseYear(value, fallback) {
    const raw = clean(value);
    if (!raw) return fallback;

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(Math.floor(parsed), 1900), upperBound);
  }

  const fromYear = parseYear(fromValue, 1990);
  const toYear = parseYear(toValue, Math.floor(currentYear));

  return {
    fromYear,
    toYear,
    valid: fromYear <= toYear,
  };
}

export function getSearchClientKey(headers) {
  const forwardedFor = clean(headers.get("x-forwarded-for"))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)[0];
  const ip =
    clean(headers.get("x-real-ip")) ||
    clean(headers.get("cf-connecting-ip")) ||
    forwardedFor ||
    "unknown";
  const userAgent = clean(headers.get("user-agent"));
  const language = clean(headers.get("accept-language"));

  return createHash("sha256")
    .update(`${ip}|${userAgent}|${language}`)
    .digest("hex")
    .slice(0, 32);
}

export function selectOpenAlexCandidateIndexes(articles, cap = MAX_OPENALEX_ENRICHMENTS) {
  const safeCap = Math.max(0, Math.floor(Number.isFinite(cap) ? cap : 0));
  const indexes = [];

  for (let index = 0; index < articles.length && indexes.length < safeCap; index += 1) {
    const article = articles[index] || {};
    if (article.quartile === "Not found" && clean(article.doi)) {
      indexes.push(index);
    }
  }

  return indexes;
}
