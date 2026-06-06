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
  quartile?: string;
  sjr?: string;
  hIndex?: string;
  publisher?: string;
  sourceUrl?: string;
  pubmedUrl?: string;
};

export async function GET() {
  try {
    const keys = await redis.keys("library:*");

    if (!keys.length) {
      return Response.json({ articles: [] });
    }

    const values = await redis.mget(...keys);

    const articles = values
      .map((value, index) => {
        if (!value) return null;

        const article =
          typeof value === "string"
            ? (JSON.parse(value) as LibraryArticle)
            : (value as LibraryArticle);

        const id =
          article.id ||
          article.pmid ||
          keys[index].replace(/^library:/, "");

        return {
          ...article,
          id,
          sourceUrl: article.sourceUrl || article.pubmedUrl || "",
        };
      })
      .filter(Boolean);

    return Response.json({ articles });
  } catch (error) {
    console.error("List library error:", error);

    return Response.json(
      { error: "Failed to load library." },
      { status: 500 }
    );
  }
}