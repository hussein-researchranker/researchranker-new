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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LibraryArticle;

    const pmid = cleanText(body.pmid);
    const title = cleanText(body.title);

    if (!pmid && !title) {
      return Response.json(
        { error: "Missing article PMID or title." },
        { status: 400 }
      );
    }

    const id = cleanText(body.id) || pmid || encodeURIComponent(title.toLowerCase());
    const key = `library:${id}`;

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
      indexingStatus: cleanText(body.indexingStatus || "Unknown / check manually"),
      sjr: cleanText(body.sjr),
      hIndex: cleanText(body.hIndex),
      publisher: cleanText(body.publisher),
      issn: cleanText(body.issn),
      matchConfidence: cleanText(body.matchConfidence || "Not matched"),
      savedAt: new Date().toISOString(),
    };

    await redis.set(key, article);

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
