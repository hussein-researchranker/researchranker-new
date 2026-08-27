import { auth } from "@clerk/nextjs/server";
import { redis } from "@/lib/redis";
import { checkRateLimit } from "@/lib/rate-limit";

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

const MAX_REQUEST_BYTES = 50_000;
const LIBRARY_WRITE_LIMIT_PER_MINUTE = 60;

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function limitText(value: unknown, maxChars: number) {
  return cleanText(value).slice(0, maxChars);
}

function makeArticleId(article: LibraryArticle) {
  const doi = limitText(article.doi, 300);
  const pmid = limitText(article.pmid, 100);
  const title = limitText(article.title, 1000);
  const providedId = limitText(article.id, 500);

  if (providedId) return providedId;
  if (doi) return doi;
  if (pmid) return pmid;

  return encodeURIComponent(title.toLowerCase()).slice(0, 1500);
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

    const rateLimit = await checkRateLimit({
      key: `library-write:${userId}`,
      limit: LIBRARY_WRITE_LIMIT_PER_MINUTE,
      windowSeconds: 60,
    });

    if (!rateLimit.success) {
      return Response.json(
        {
          error: "Library write rate limit reached. Please try again shortly.",
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

    const contentLength = Number(request.headers.get("content-length") || "0");

    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return Response.json(
        { error: "Article payload is too large." },
        { status: 413 }
      );
    }

    const body = (await request.json()) as LibraryArticle;
    const pmid = limitText(body.pmid, 100);
    const doi = limitText(body.doi, 300);
    const title = limitText(body.title, 1000);

    if (!pmid && !doi && !title) {
      return Response.json(
        { error: "Missing article DOI, PMID, or title." },
        { status: 400 }
      );
    }

    const id = makeArticleId({ ...body, pmid, doi, title });

    if (!id) {
      return Response.json(
        { error: "Could not create a safe article ID." },
        { status: 400 }
      );
    }

    const articleKey = `library:${userId}:article:${id}`;
    const indexKey = `library:${userId}:ids`;

    const article = {
      id,
      pmid,
      title,
      journal: limitText(body.journal, 500),
      pubdate: limitText(body.pubdate, 100),
      authors: limitText(body.authors, 3000),
      doi,
      abstract: limitText(body.abstract, 12_000),
      source: limitText(body.source || "Academic metadata", 100),
      sourceUrl: limitText(body.sourceUrl || body.pubmedUrl, 2000),
      pubmedUrl: limitText(body.pubmedUrl || body.sourceUrl, 2000),
      quartile: limitText(body.quartile || "Not verified", 50),
      indexingStatus: limitText(
        body.indexingStatus || "Unknown / check manually",
        500
      ),
      sjr: limitText(body.sjr, 100),
      hIndex: limitText(body.hIndex, 100),
      publisher: limitText(body.publisher, 500),
      issn: limitText(body.issn, 200),
      matchConfidence: limitText(body.matchConfidence || "Not matched", 500),
      savedAt: new Date().toISOString(),
    };

    await redis.set(articleKey, article);
    await redis.sadd(indexKey, id);

    return Response.json({
      success: true,
      article,
      storage: "persistent",
    });
  } catch (error) {
    console.error("Save library storage error:", error);

    return Response.json(
      {
        error:
          "Persistent library storage is currently unavailable. The article was not saved; please retry after the database connection is restored.",
        code: "PERSISTENT_STORAGE_UNAVAILABLE",
      },
      { status: 503 }
    );
  }
}
