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

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function makeArticleId(article: LibraryArticle) {
  const pmid = cleanText(article.pmid);
  const title = cleanText(article.title);
  const providedId = cleanText(article.id);

  if (providedId) return providedId;
  if (pmid) return pmid;

  return encodeURIComponent(title.toLowerCase());
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

    const pmid = cleanText(body.pmid);
    const title = cleanText(body.title);

    if (!pmid && !title) {
      return Response.json(
        { error: "Missing article PMID or title." },
        { status: 400 }
      );
    }

    const id = makeArticleId(body);
    const articleKey = `library:${userId}:article:${id}`;
    const indexKey = `library:${userId}:ids`;

    const article = {
      id,
      pmid,
      title,
      journal: cleanText(body.journal),
      pubdate: cleanText(body.pubdate),
      authors: cleanText(body.authors),
      doi: cleanText(body.doi),
      abstract: cleanText(body.abstract),
      source: cleanText(body.source || "PubMed"),
      sourceUrl: cleanText(body.sourceUrl || body.pubmedUrl),
      pubmedUrl: cleanText(body.pubmedUrl || body.sourceUrl),
      quartile: cleanText(body.quartile || "Not found"),
      indexingStatus: cleanText(
        body.indexingStatus || "Unknown / check manually"
      ),
      sjr: cleanText(body.sjr),
      hIndex: cleanText(body.hIndex),
      publisher: cleanText(body.publisher),
      issn: cleanText(body.issn),
      matchConfidence: cleanText(body.matchConfidence || "Not matched"),
      savedAt: new Date().toISOString(),
    };

    await redis.set(articleKey, article);
    await redis.sadd(indexKey, id);

    return Response.json({
      success: true,
      article,
    });
  } catch (error) {
    console.error("Save library article error:", error);

    return Response.json(
      { error: "Failed to save article." },
      { status: 500 }
    );
  }
}