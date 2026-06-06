import { auth } from "@clerk/nextjs/server";
import { redis } from "@/lib/redis";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: "You must sign in to view your library." },
        { status: 401 }
      );
    }

    const listKey = `library:${userId}:articles`;
    const ids = await redis.smembers<string[]>(listKey);

    if (!ids || ids.length === 0) {
      return Response.json({
        articles: [],
      });
    }

    const keys = ids.map((id) => `library:${userId}:article:${id}`);
    const articles = await redis.mget(...keys);

    return Response.json({
      articles: articles.filter(Boolean),
    });
  } catch (error) {
    console.error("List library articles error:", error);

    return Response.json(
      { error: "Failed to load library." },
      { status: 500 }
    );
  }
}