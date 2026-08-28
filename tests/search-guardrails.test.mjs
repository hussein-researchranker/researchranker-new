import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_OPENALEX_ENRICHMENTS,
  MAX_SEARCH_QUERY_CHARS,
  MAX_SEARCH_RESULTS,
  getSearchClientKey,
  normalizeSearchField,
  normalizeSearchQuery,
  parseSearchResultLimit,
  parseSearchYearRange,
  selectOpenAlexCandidateIndexes,
} from "../lib/search-guardrails.mjs";

test("normalizes search queries and flags oversized input", () => {
  assert.deepEqual(normalizeSearchQuery("  kidney   disease  "), {
    query: "kidney disease",
    tooLong: false,
  });

  const oversized = "x".repeat(MAX_SEARCH_QUERY_CHARS + 1);
  assert.equal(normalizeSearchQuery(oversized).tooLong, true);
});

test("accepts known fields and falls back safely", () => {
  assert.equal(normalizeSearchField("Biochemistry"), "biochemistry");
  assert.equal(normalizeSearchField("not-a-real-field"), "all");
});

test("search result limits are finite and capped", () => {
  assert.equal(parseSearchResultLimit(null), 1);
  assert.equal(parseSearchResultLimit("not-a-number"), MAX_SEARCH_RESULTS);
  assert.equal(parseSearchResultLimit("0"), 1);
  assert.equal(parseSearchResultLimit("25"), 25);
  assert.equal(parseSearchResultLimit("500"), MAX_SEARCH_RESULTS);
});

test("year ranges are clamped and inverted ranges are rejected", () => {
  assert.deepEqual(parseSearchYearRange("1800", "2099", 2026), {
    fromYear: 1900,
    toYear: 2027,
    valid: true,
  });

  assert.equal(parseSearchYearRange("2025", "2020", 2026).valid, false);
});

test("client key is deterministic and does not expose raw IP", () => {
  const headers = new Headers({
    "x-forwarded-for": "203.0.113.42, 10.0.0.1",
    "user-agent": "ResearchRanker-Test",
    "accept-language": "ar-IQ",
  });

  const first = getSearchClientKey(headers);
  const second = getSearchClientKey(headers);

  assert.equal(first, second);
  assert.equal(first.length, 32);
  assert.equal(first.includes("203.0.113.42"), false);
});

test("OpenAlex enrichment candidates are strictly capped", () => {
  const articles = Array.from({ length: MAX_OPENALEX_ENRICHMENTS + 8 }, (_, index) => ({
    doi: `10.1000/${index}`,
    quartile: "Not found",
  }));

  const indexes = selectOpenAlexCandidateIndexes(articles);
  assert.equal(indexes.length, MAX_OPENALEX_ENRICHMENTS);
  assert.deepEqual(indexes, Array.from({ length: MAX_OPENALEX_ENRICHMENTS }, (_, index) => index));
});

test("OpenAlex enrichment skips verified or DOI-less records", () => {
  const indexes = selectOpenAlexCandidateIndexes([
    { doi: "10.1000/verified", quartile: "Q1" },
    { doi: "", quartile: "Not found" },
    { doi: "10.1000/eligible", quartile: "Not found" },
  ]);

  assert.deepEqual(indexes, [2]);
});
