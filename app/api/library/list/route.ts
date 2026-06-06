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
  savedAt?: string;
};

function normalizeArticle(value: unknown): LibraryArticle | null {
  if (!value) return null;

  try {
    const article =
      typeof value === "string"
        ? (JSON.parse(value) as LibraryArticle)
        : (value as LibraryArticle);

    const id = article.id || article.pmid || article.title || "";

    if (!id) return null;

    return {
      ...article,
      id,
      source: article.source || "PubMed",
      sourceUrl: article.sourceUrl || article.pubmedUrl || "",
      pubmedUrl: article.pubmedUrl || article.sourceUrl || "",
      quartile: article.quartile || "Not found",
      indexingStatus: article.indexingStatus || "Unknown / check manually",
      matchConfidence: article.matchConfidence || "Not matched",
    };
  } catch (error) {
    console.error("Normalize library article error:", error);
    return null;
  }
}

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: "You must sign in to view your library." },
        { status: 401 }
      );
    }

    const indexKey = `library:${userId}:ids`;
    const ids = (await redis.smembers(indexKey)) as string[];

    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.json({ articles: [] });
    }

    const articleKeys = ids.map((id) => `library:${userId}:article:${id}`);
    const values = await redis.mget(...articleKeys);

    const articles = values
      .map(normalizeArticle)
      .filter((article): article is LibraryArticle => Boolean(article))
      .sort((a, b) => {
        const aTime = Date.parse(a.savedAt || "");
        const bTime = Date.parse(b.savedAt || "");

        return (
          (Number.isFinite(bTime) ? bTime : 0) -
          (Number.isFinite(aTime) ? aTime : 0)
        );
      });

    return Response.json({ articles });
  } catch (error) {
    console.error("List library error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to load library.";

    return Response.json(
      { error: message },
      { status: 500 }
    );
  }
}