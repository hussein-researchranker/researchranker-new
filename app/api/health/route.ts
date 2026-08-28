import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  let redisStatus: "ok" | "error" = "ok";

  try {
    await redis.ping();
  } catch (error) {
    redisStatus = "error";
    console.error("Health check Redis error:", error);
  }

  const status = redisStatus === "ok" ? "ok" : "degraded";

  return Response.json(
    {
      status,
      services: {
        redis: redisStatus,
      },
      deployment: {
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
        region: process.env.VERCEL_REGION || "unknown",
        commit: (process.env.VERCEL_GIT_COMMIT_SHA || "unknown").slice(0, 12),
        branch: process.env.VERCEL_GIT_COMMIT_REF || "unknown",
        url: process.env.VERCEL_URL || "unknown",
      },
      responseTimeMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    },
    {
      status: status === "ok" ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
