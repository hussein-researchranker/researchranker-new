import { checkRedisHealth } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const storage = await checkRedisHealth();

  const authConfigured = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
  );
  const aiConfigured = Boolean(process.env.GEMINI_API_KEY);

  const status = storage.ok ? "ok" : "degraded";

  return Response.json(
    {
      status,
      service: "researchranker",
      timestamp: new Date().toISOString(),
      deployment: {
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || null,
        environment: process.env.VERCEL_ENV || null,
      },
      checks: {
        application: true,
        authenticationConfigured: authConfigured,
        aiConfigured,
        scholarlySearchAvailable: true,
        persistentStorage: {
          configured: storage.configured,
          healthy: storage.ok,
        },
      },
      note: storage.ok
        ? "All required runtime checks passed."
        : "Application is online, but persistent Redis storage is unavailable; search rate limiting will use its safe in-memory fallback and library persistence may be unavailable.",
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}