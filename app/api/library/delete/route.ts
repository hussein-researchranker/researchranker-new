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
        { error: "You must sign in to delete articles." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const articleId = cleanText(body?.id);

    if (!articleId) {
      return Response.json(
        { error: "Missing article ID." },
        { status: 400 }
      );
    }

    const articleKey = `library:${userId}:article:${articleId}`;
    const listKey = `library:${userId}:articles`;

    await redis.del(articleKey);
    await redis.srem(listKey, articleId);

    return Response.json({
      ok: true,
    });
  } catch (error) {
    console.error("Delete library article error:", error);

    return Response.json(
      { error: "Failed to delete article." },
      { status: 500 }
    );
  }
}