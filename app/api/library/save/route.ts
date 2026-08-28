import { auth } from "@clerk/nextjs/server";
import { redis } from "@/lib/redis";

type LibraryArticle = {
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
};

type StoredLibraryArticle = LibraryArticle & {
  savedAt?: string;
  updatedAt?: string;
  favorite?: boolean;
  readingStatus?: "to-read" | "reading" | "read";
  notes?: string;
  tags?: string[];
  collection?: string;
  screeningStatus?: "include" | "exclude" | "maybe" | "unscreened";
  exclusionReason?: string;
  fullTextStatus?: "pending" | "retrieved" | "unavailable" | "not-needed";
  duplicateOf?: string;
  extraction?: Record<string, string>;
};

function cleanText(value: unknown, max = 4000) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanUrl(value: unknown) {
  const raw = cleanText(value, 1500);
  if (!raw) return "";

  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

function makeArticleId(article: LibraryArticle) {
  const pmid = cleanText(article.pmid, 120);
  const title = cleanText(article.title, 1000);
  const providedId = cleanText(article.id, 500);

  if (providedId) return providedId;
  if (pmid) return pmid;

  return encodeURIComponent(title.toLowerCase()).slice(0, 500);
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: "You must sign in to save articles." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as LibraryArticle;
    const pmid = cleanText(body.pmid, 120);
    const title = cleanText(body.title, 1000);

    if (!pmid && !title) {
      return Response.json(
        { error: "Missing article PMID or title." },
        { status: 400 }
      );
    }

    const id = makeArticleId(body);
    if (!id) {
      return Response.json({ error: "Invalid article ID." }, { status: 400 });
    }

    const articleKey = `library:${userId}:article:${id}`;
    const indexKey = `library:${userId}:ids`;
    const existing = await redis.get<StoredLibraryArticle>(articleKey);
    const now = new Date().toISOString();

    const article: StoredLibraryArticle = {
      id,
      pmid,
      title,
      journal: cleanText(body.journal, 500),
      pubdate: cleanText(body.pubdate, 120),
      authors: cleanText(body.authors, 1500),
      doi: cleanText(body.doi, 300),
      abstract: cleanText(body.abstract, 12000),
      source: cleanText(body.source || "PubMed", 120),
      sourceUrl: cleanUrl(body.sourceUrl || body.pubmedUrl),
      pubmedUrl: cleanUrl(body.pubmedUrl || body.sourceUrl),
      quartile: cleanText(body.quartile || "Not found", 20),
      indexingStatus: cleanText(
        body.indexingStatus || "Unknown / check manually",
        250
      ),
      sjr: cleanText(body.sjr, 50),
      hIndex: cleanText(body.hIndex, 50),
      publisher: cleanText(body.publisher, 500),
      issn: cleanText(body.issn, 120),
      matchConfidence: cleanText(body.matchConfidence || "Not matched", 300),
      savedAt: existing?.savedAt || now,
      updatedAt: now,
      favorite: existing?.favorite ?? false,
      readingStatus: existing?.readingStatus || "to-read",
      notes: existing?.notes || "",
      tags: Array.isArray(existing?.tags) ? existing.tags : [],
      collection: existing?.collection || "Unsorted",
      screeningStatus: existing?.screeningStatus || "unscreened",
      exclusionReason: existing?.exclusionReason || "",
      fullTextStatus: existing?.fullTextStatus || "pending",
      duplicateOf: existing?.duplicateOf || "",
      extraction:
        existing?.extraction && typeof existing.extraction === "object"
          ? existing.extraction
          : {},
    };

    await redis.set(articleKey, article);
    await redis.sadd(indexKey, id);

    return Response.json({
      success: true,
      article,
      alreadySaved: Boolean(existing),
    });
  } catch (error) {
    console.error("Save library article error:", error);

    return Response.json(
      { error: "Failed to save article." },
      { status: 500 }
    );
  }
}
