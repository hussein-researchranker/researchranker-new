import { auth } from "@clerk/nextjs/server";
import { redis } from "@/lib/redis";
import {
  normalizeLibraryArticle,
  type LibraryArticle,
} from "@/lib/research-types";

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
      .map(normalizeLibraryArticle)
      .filter((article): article is LibraryArticle => Boolean(article))
      .sort((a, b) => {
        const aTime = Date.parse(a.savedAt || "");
        const bTime = Date.parse(b.savedAt || "");
        return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
      });

    return Response.json({ articles });
  } catch (error) {
    console.error("List library error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to load library." },
      { status: 500 }
    );
  }
}
