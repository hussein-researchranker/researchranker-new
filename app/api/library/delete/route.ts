import { auth } from "@clerk/nextjs/server";
import { redis } from "@/lib/redis";
import { checkRateLimit } from "@/lib/rate-limit";

const LIBRARY_WRITE_LIMIT_PER_MINUTE = 60;
const MAX_ID_CHARS = 1500;

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

    const body = await request.json();
    const rawId = cleanText(body?.id || body?.pmid || body?.title).slice(
      0,
      MAX_ID_CHARS
    );

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
