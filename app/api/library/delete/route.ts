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
    const rawId = cleanText(body?.id || body?.pmid || body?.title);

    if (!rawId) {
      return Response.json(
        { error: "Missing article ID." },
        { status: 400 }
      );
    }

    const articleKey = `library:${userId}:article:${rawId}`;
    const indexKey = `library:${userId}:ids`;

    await redis.del(articleKey);
    await redis.srem(indexKey, rawId);

    return Response.json({
      success: true,
      deletedId: rawId,
    });
  } catch (error) {
    console.error("Delete library article error:", error);

    return Response.json(
      { error: "Failed to delete article." },
      { status: 500 }
    );
  }
}