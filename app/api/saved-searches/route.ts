import { auth } from "@clerk/nextjs/server";
import { redis } from "@/lib/redis";

type SavedSearch = {
  id: string;
  query: string;
  quartile: string;
  field: string;
  alertEnabled: boolean;
  createdAt: string;
  lastCheckedAt?: string;
  lastResultCount?: number;
};

function cleanText(value: unknown, max = 500) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function makeId(query: string, quartile: string, field: string) {
  return Buffer.from(`${query}|${quartile}|${field}`)
    .toString("base64url")
    .slice(0, 120);
}

function alertIndexKey(userId: string, searchId: string) {
  return `saved-searches:${userId}:alerts:${searchId}:ids`;
}

function alertKey(userId: string, searchId: string, workId: string) {
  return `saved-searches:${userId}:alert:${searchId}:${Buffer.from(workId).toString("base64url")}`;
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });

    const ids = (await redis.smembers(`saved-searches:${userId}:ids`)) as string[];
    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.json({ searches: [] });
    }

    const values = (await redis.mget(
      ...ids.map((id) => `saved-searches:${userId}:item:${id}`)
    )) as Array<SavedSearch | null>;

    const searches = values
      .filter((item): item is SavedSearch => Boolean(item))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

    return Response.json({ searches });
  } catch (error) {
    console.error("List saved searches error:", error);
    return Response.json({ error: "Failed to load saved searches." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });

    const body = await request.json();
    const query = cleanText(body?.query, 500);
    const quartile = cleanText(body?.quartile || "All", 20);
    const field = cleanText(body?.field || "all", 120);
    if (!query) return Response.json({ error: "Search query is required." }, { status: 400 });

    const id = makeId(query, quartile, field);
    const key = `saved-searches:${userId}:item:${id}`;
    const existing = await redis.get<SavedSearch>(key);

    const item: SavedSearch = {
      id,
      query,
      quartile,
      field,
      alertEnabled: body?.alertEnabled !== false,
      createdAt: existing?.createdAt || new Date().toISOString(),
      lastCheckedAt: existing?.lastCheckedAt,
      lastResultCount: existing?.lastResultCount,
    };

    await redis.set(key, item);
    await redis.sadd(`saved-searches:${userId}:ids`, id);
    await redis.sadd("saved-searches:users", userId);

    return Response.json({ success: true, search: item });
  } catch (error) {
    console.error("Save search error:", error);
    return Response.json({ error: "Failed to save search." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });

    const body = await request.json();
    const id = cleanText(body?.id, 150);
    if (!id) return Response.json({ error: "Missing search id." }, { status: 400 });

    const key = `saved-searches:${userId}:item:${id}`;
    const existing = await redis.get<SavedSearch>(key);
    if (!existing) return Response.json({ error: "Saved search not found." }, { status: 404 });

    const next: SavedSearch = {
      ...existing,
      ...(typeof body?.alertEnabled === "boolean"
        ? { alertEnabled: body.alertEnabled }
        : {}),
    };

    await redis.set(key, next);
    return Response.json({ success: true, search: next });
  } catch (error) {
    console.error("Update saved search error:", error);
    return Response.json({ error: "Failed to update saved search." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });

    const body = await request.json();
    const id = cleanText(body?.id, 150);
    if (!id) return Response.json({ error: "Missing search id." }, { status: 400 });

    const alertIds = (await redis.smembers(alertIndexKey(userId, id))) as string[];
    if (Array.isArray(alertIds) && alertIds.length > 0) {
      await Promise.all(
        alertIds.map((workId) => redis.del(alertKey(userId, id, workId)))
      );
    }

    await Promise.all([
      redis.del(`saved-searches:${userId}:item:${id}`),
      redis.del(`saved-searches:${userId}:seen:${id}`),
      redis.del(alertIndexKey(userId, id)),
      redis.srem(`saved-searches:${userId}:ids`, id),
    ]);

    return Response.json({ success: true });
  } catch (error) {
    console.error("Delete saved search error:", error);
    return Response.json({ error: "Failed to delete saved search." }, { status: 500 });
  }
}
