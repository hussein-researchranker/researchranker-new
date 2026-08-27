export type ReadingStatus = "to-read" | "reading" | "read";
export type ScreeningStatus = "unscreened" | "include" | "exclude" | "maybe";

export type LibraryArticle = {
  id?: string;
  pmid?: string;
  title?: string;
  journal?: string;
  pubdate?: string;
  authors?: string;
  doi?: string;
  abstract?: string;
  source?: string;
  sourceUrl?: string;
  pubmedUrl?: string;
  quartile?: string;
  indexingStatus?: string;
  sjr?: string;
  hIndex?: string;
  publisher?: string;
  issn?: string;
  matchConfidence?: string;
  savedAt?: string;
  updatedAt?: string;
  tags?: string[];
  collectionIds?: string[];
  notes?: string;
  favorite?: boolean;
  readingStatus?: ReadingStatus;
  /** Legacy single-stage status retained for backwards compatibility. */
  screeningStatus?: ScreeningStatus;
  screeningReason?: string;
  titleAbstractStatus?: ScreeningStatus;
  titleAbstractReason?: string;
  fullTextStatus?: ScreeningStatus;
  fullTextReason?: string;
  extraction?: Record<string, string>;
};

export type ResearchCollection = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

export type SavedSearch = {
  id: string;
  query: string;
  field: string;
  quartile: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastCheckedAt?: string;
  lastSeenKeys?: string[];
  unreadCount?: number;
};

export type SearchAlert = {
  id: string;
  savedSearchId: string;
  articleKey: string;
  title: string;
  journal?: string;
  doi?: string;
  pubdate?: string;
  relevanceScore: number;
  createdAt: string;
  read: boolean;
};

export function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function makeStableArticleId(article: LibraryArticle) {
  const provided = cleanText(article.id);
  const doi = cleanText(article.doi).toLowerCase();
  const pmid = cleanText(article.pmid);
  const title = cleanText(article.title).toLowerCase();

  if (provided) return provided;
  if (doi) return `doi:${doi}`;
  if (pmid) return `pmid:${pmid}`;
  return `title:${encodeURIComponent(title)}`;
}

export function normalizeLibraryArticle(value: unknown): LibraryArticle | null {
  if (!value) return null;

  try {
    const article =
      typeof value === "string"
        ? (JSON.parse(value) as LibraryArticle)
        : (value as LibraryArticle);

    const id = makeStableArticleId(article);
    if (!cleanText(id)) return null;

    const legacyScreening = article.screeningStatus || "unscreened";
    const legacyReason = cleanText(article.screeningReason);

    return {
      ...article,
      id,
      source: cleanText(article.source || "PubMed"),
      sourceUrl: cleanText(article.sourceUrl || article.pubmedUrl),
      pubmedUrl: cleanText(article.pubmedUrl || article.sourceUrl),
      quartile: cleanText(article.quartile || "Not found"),
      indexingStatus: cleanText(article.indexingStatus || "Unknown / check manually"),
      matchConfidence: cleanText(article.matchConfidence || "Not matched"),
      tags: Array.isArray(article.tags)
        ? article.tags.map(cleanText).filter(Boolean).slice(0, 20)
        : [],
      collectionIds: Array.isArray(article.collectionIds)
        ? article.collectionIds.map(cleanText).filter(Boolean).slice(0, 20)
        : [],
      notes: cleanText(article.notes),
      favorite: Boolean(article.favorite),
      readingStatus: article.readingStatus || "to-read",
      screeningStatus: legacyScreening,
      screeningReason: legacyReason,
      titleAbstractStatus: article.titleAbstractStatus || legacyScreening,
      titleAbstractReason: cleanText(article.titleAbstractReason || legacyReason),
      fullTextStatus: article.fullTextStatus || "unscreened",
      fullTextReason: cleanText(article.fullTextReason),
      extraction:
        article.extraction && typeof article.extraction === "object"
          ? Object.fromEntries(
              Object.entries(article.extraction)
                .slice(0, 30)
                .map(([key, entry]) => [cleanText(key), cleanText(entry)])
                .filter(([key]) => Boolean(key))
            )
          : {},
    };
  } catch {
    return null;
  }
}
