import { auth } from "@clerk/nextjs/server";
import { redis } from "@/lib/redis";
import { cleanText, type SavedSearch } from "@/lib/research-types";

function makeId() {
  return `search_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function getSearches(userId: string) {
  const ids = (await redis.smembers(`saved-searches:${userId}:ids`)) as string[];
  if (!ids.length) return [] as SavedSearch[];
  const values = await redis.mget(...ids.map((id) => `saved-searches:${userId}:${id}`));
  return values
    .map((value) => {
      if (!value) return null;
      return typeof value === "string" ? (JSON.parse(value) as SavedSearch) : (value as SavedSearch);
    })
    .filter((value): value is SavedSearch => Boolean(value))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  return Response.json({ searches: await getSearches(userId) });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });

  const body = await request.json();
  const query = cleanText(body?.query).slice(0, 300);
  if (!query) return Response.json({ error: "Search query is required." }, { status: 400 });

  const now = new Date().toISOString();
  const search: SavedSearch = {
    id: makeId(),
    query,
    field: cleanText(body?.field || "all").slice(0, 80),
    quartile: cleanText(body?.quartile || "All").slice(0, 10),
    enabled: body?.enabled !== false,
    createdAt: now,
    updatedAt: now,
    lastSeenKeys: [],
    unreadCount: 0,
  };

  await redis.set(`saved-searches:${userId}:${search.id}`, search);
  await redis.sadd(`saved-searches:${userId}:ids`, search.id);
  return Response.json({ success: true, search });
}

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });

  const body = await request.json();
  const id = cleanText(body?.id);
  if (!id) return Response.json({ error: "Missing saved-search id." }, { status: 400 });

  const key = `saved-searches:${userId}:${id}`;
  const raw = await redis.get(key);
  if (!raw) return Response.json({ error: "Saved search not found." }, { status: 404 });
  const current = typeof raw === "string" ? (JSON.parse(raw) as SavedSearch) : (raw as SavedSearch);

  const next: SavedSearch = {
    ...current,
    ...(typeof body?.enabled === "boolean" ? { enabled: body.enabled } : {}),
    ...(cleanText(body?.query) ? { query: cleanText(body.query).slice(0, 300) } : {}),
    ...(cleanText(body?.field) ? { field: cleanText(body.field).slice(0, 80) } : {}),
    ...(cleanText(body?.quartile) ? { quartile: cleanText(body.quartile).slice(0, 10) } : {}),
    updatedAt: new Date().toISOString(),
  };

  await redis.set(key, next);
  return Response.json({ success: true, search: next });
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });

  const body = await request.json();
  const id = cleanText(body?.id);
  if (!id) return Response.json({ error: "Missing saved-search id." }, { status: 400 });

  await redis.del(`saved-searches:${userId}:${id}`);
  await redis.srem(`saved-searches:${userId}:ids`, id);

  const alertIds = (await redis.smembers(`alerts:${userId}:ids`)) as string[];
  if (alertIds.length) {
    const alertKeys = alertIds.map((alertId) => `alerts:${userId}:${alertId}`);
    const values = await redis.mget(...alertKeys);
    await Promise.all(
      values.map(async (value, index) => {
        if (!value) return;
        const alert = typeof value === "string" ? JSON.parse(value) : value;
        if (alert.savedSearchId !== id) return;
        const alertId = alertIds[index];
        await redis.del(alertKeys[index]);
        await redis.srem(`alerts:${userId}:ids`, alertId);
      })
    );
  }

  return Response.json({ success: true });
}
