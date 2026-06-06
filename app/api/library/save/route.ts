import { auth } from "@clerk/nextjs/server";
import { redis } from "@/lib/redis";

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
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

    const body = await request.json();

    const pmid = cleanText(body?.pmid);
    const title = cleanText(body?.title);
    const journal = cleanText(body?.journal);
    const pubdate = cleanText(body?.pubdate);
    const authors = cleanText(body?.authors);
    const doi = cleanText(body?.doi);
    const abstract = cleanText(body?.abstract);
    const quartile = cleanText(body?.quartile);
    const sjr = cleanText(body?.sjr);
    const hIndex = cleanText(body?.hIndex);
    const publisher = cleanText(body?.publisher);
    const pubmedUrl = cleanText(body?.pubmedUrl);

    if (!pmid && !title) {
      return Response.json(
        { error: "Missing article PMID or title." },
        { status: 400 }
      );
    }

    const articleId =
      pmid ||
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 80);

    const savedArticle = {
      id: articleId,
      pmid,
      title,
      journal,
      pubdate,
      authors,
      doi,
      abstract,
      quartile,
      sjr,
      hIndex,
      publisher,
      pubmedUrl,
      savedAt: new Date().toISOString(),
    };

    const articleKey = `library:${userId}:article:${articleId}`;
    const listKey = `library:${userId}:articles`;

    await redis.set(articleKey, savedArticle);
    await redis.sadd(listKey, articleId);

    return Response.json({
      ok: true,
      article: savedArticle,
    });
  } catch (error) {
    console.error("Save library article error:", error);

    return Response.json(
      { error: "Failed to save article." },
      { status: 500 }
    );
  }
}