import { redis } from "@/lib/redis";

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const rawId = cleanText(body?.id || body?.pmid || body?.title);

    if (!rawId) {
      return Response.json(
        { error: "Missing article ID." },
        { status: 400 }
      );
    }

    const key = rawId.startsWith("library:")
      ? rawId
      : `library:${rawId}`;

    await redis.del(key);

    return Response.json({
      success: true,
      deletedKey: key,
    });
  } catch (error) {
    console.error("Delete library article error:", error);

    return Response.json(
      { error: "Failed to delete article." },
      { status: 500 }
    );
  }
}