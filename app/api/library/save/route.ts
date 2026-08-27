import { auth } from "@clerk/nextjs/server";
import { redis } from "@/lib/redis";
import {
  cleanText,
  makeStableArticleId,
  normalizeLibraryArticle,
  type LibraryArticle,
} from "@/lib/research-types";

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
    const title = cleanText(body.title);
    const doi = cleanText(body.doi);
    const pmid = cleanText(body.pmid);

    if (!title && !doi && !pmid) {
      return Response.json(
        { error: "Missing article DOI, PMID, or title." },
        { status: 400 }
      );
    }

    const id = makeStableArticleId(body);
    const articleKey = `library:${userId}:article:${id}`;
    const indexKey = `library:${userId}:ids`;
    const now = new Date().toISOString();

    const current = normalizeLibraryArticle(await redis.get(articleKey));

    const article: LibraryArticle = {
      ...current,
      id,
      pmid,
      title,
      journal: cleanText(body.journal || current?.journal),
      pubdate: cleanText(body.pubdate || current?.pubdate),
      authors: cleanText(body.authors || current?.authors),
      doi,
      abstract: cleanText(body.abstract || current?.abstract),
      source: cleanText(body.source || current?.source || "PubMed"),
      sourceUrl: cleanText(
        body.sourceUrl || body.pubmedUrl || current?.sourceUrl || current?.pubmedUrl
      ),
      pubmedUrl: cleanText(
        body.pubmedUrl || body.sourceUrl || current?.pubmedUrl || current?.sourceUrl
      ),
      quartile: cleanText(body.quartile || current?.quartile || "Not found"),
      indexingStatus: cleanText(
        body.indexingStatus || current?.indexingStatus || "Unknown / check manually"
      ),
      sjr: cleanText(body.sjr || current?.sjr),
      hIndex: cleanText(body.hIndex || current?.hIndex),
      publisher: cleanText(body.publisher || current?.publisher),
      issn: cleanText(body.issn || current?.issn),
      matchConfidence: cleanText(
        body.matchConfidence || current?.matchConfidence || "Not matched"
      ),
      tags: current?.tags || [],
      collectionIds: current?.collectionIds || [],
      notes: current?.notes || "",
      favorite: current?.favorite || false,
      readingStatus: current?.readingStatus || "to-read",
      screeningStatus: current?.screeningStatus || "unscreened",
      screeningReason: current?.screeningReason || "",
      titleAbstractStatus:
        current?.titleAbstractStatus || current?.screeningStatus || "unscreened",
      titleAbstractReason:
        current?.titleAbstractReason || current?.screeningReason || "",
      fullTextStatus: current?.fullTextStatus || "unscreened",
      fullTextReason: current?.fullTextReason || "",
      extraction: current?.extraction || {},
      savedAt: current?.savedAt || now,
      updatedAt: now,
    };

    await redis.set(articleKey, article);
    await redis.sadd(indexKey, id);

    return Response.json({ success: true, article });
  } catch (error) {
    console.error("Save library article error:", error);

    return Response.json(
      { error: "Failed to save article." },
      { status: 500 }
    );
  }
}
