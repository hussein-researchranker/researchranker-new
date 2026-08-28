function cleanText(value) {
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

export function normalizeIssn(value) {
  return cleanText(value)
    .replace(/[^0-9xX]/g, "")
    .toUpperCase();
}

export function splitIssns(value) {
  return cleanText(value)
    .split(/[,;]+/)
    .map(normalizeIssn)
    .filter((issn) => /^[0-9]{7}[0-9X]$/.test(issn));
}

export function normalizeJournalTitle(value) {
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

export function getTitleTokens(value) {
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

export function tokenSimilarity(a, b) {
  if (!a.length || !b.length) return 0;

  const aSet = new Set(a);
  const bSet = new Set(b);
  const intersection = [...aSet].filter((token) => bSet.has(token)).length;
  const union = new Set([...aSet, ...bSet]).size;

  return union === 0 ? 0 : intersection / union;
}

export function findScimagoMatch(article, journals) {
  const articleIssns = splitIssns(article?.issn || "");

  if (articleIssns.length > 0) {
    const issnMatch = journals.find((journal) =>
      (journal?.issns || []).some((journalIssn) => articleIssns.includes(journalIssn))
    );

    if (issnMatch) {
      return {
        journal: issnMatch,
        confidence: "ISSN exact match",
      };
    }
  }

  const articleJournalTitle = normalizeJournalTitle(article?.journal || "");

  if (!articleJournalTitle) {
    return null;
  }

  const exactTitleMatch = journals.find(
    (journal) => journal?.normalizedTitle === articleJournalTitle
  );

  if (exactTitleMatch) {
    return {
      journal: exactTitleMatch,
      confidence: "Journal title exact match",
    };
  }

  const articleTokens = getTitleTokens(article?.journal || "");

  // A single generic token (for example, only "medicine") is not enough
  // evidence for a safe fuzzy quartile assignment.
  if (articleTokens.length < 2) {
    return null;
  }

  let bestMatch = null;

  for (const journal of journals) {
    if (!journal?.normalizedTitle || journal.normalizedTitle.length < 10) {
      continue;
    }

    const journalTokens = Array.isArray(journal.titleTokens) ? journal.titleTokens : [];

    if (journalTokens.length < 2) {
      continue;
    }

    const score = tokenSimilarity(articleTokens, journalTokens);
    const sharedTokenCount = new Set(
      articleTokens.filter((token) => journalTokens.includes(token))
    ).size;

    if (
      sharedTokenCount >= 2 &&
      score >= 0.92 &&
      (!bestMatch || score > bestMatch.score)
    ) {
      bestMatch = {
        journal,
        score,
      };
    }
  }

  if (bestMatch) {
    return {
      journal: bestMatch.journal,
      confidence: `Journal title strict token match (${bestMatch.score.toFixed(2)})`,
    };
  }

  return null;
}
