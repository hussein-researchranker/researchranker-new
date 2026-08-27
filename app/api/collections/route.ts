import { auth } from "@clerk/nextjs/server";
import { redis } from "@/lib/redis";
import { cleanText, type ResearchCollection } from "@/lib/research-types";

function collectionId() {
  return `col_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });

  const ids = (await redis.smembers(`collections:${userId}:ids`)) as string[];
  if (!ids.length) return Response.json({ collections: [] });

  const values = await redis.mget(...ids.map((id) => `collections:${userId}:${id}`));
  const collections = values
    .map((value) => {
      if (!value) return null;
      return typeof value === "string"
        ? (JSON.parse(value) as ResearchCollection)
        : (value as ResearchCollection);
    })
    .filter((value): value is ResearchCollection => Boolean(value))
    .sort((a, b) => a.name.localeCompare(b.name));

  return Response.json({ collections });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });

  const body = await request.json();
  const name = cleanText(body?.name).slice(0, 80);
  const description = cleanText(body?.description).slice(0, 240);
  if (!name) return Response.json({ error: "Collection name is required." }, { status: 400 });

  const now = new Date().toISOString();
  const collection: ResearchCollection = {
    id: collectionId(),
    name,
    description,
    createdAt: now,
    updatedAt: now,
  };

  await redis.set(`collections:${userId}:${collection.id}`, collection);
  await redis.sadd(`collections:${userId}:ids`, collection.id);
  return Response.json({ success: true, collection });
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });

  const body = await request.json();
  const id = cleanText(body?.id);
  if (!id) return Response.json({ error: "Missing collection id." }, { status: 400 });

  await redis.del(`collections:${userId}:${id}`);
  await redis.srem(`collections:${userId}:ids`, id);

  const articleIds = (await redis.smembers(`library:${userId}:ids`)) as string[];
  if (articleIds.length) {
    const keys = articleIds.map((articleId) => `library:${userId}:article:${articleId}`);
    const values = await redis.mget(...keys);
    await Promise.all(
      values.map(async (value, index) => {
        if (!value) return;
        const article = typeof value === "string" ? JSON.parse(value) : value;
        if (!Array.isArray(article.collectionIds) || !article.collectionIds.includes(id)) return;
        article.collectionIds = article.collectionIds.filter((collectionId: string) => collectionId !== id);
        article.updatedAt = new Date().toISOString();
        await redis.set(keys[index], article);
      })
    );
  }

  return Response.json({ success: true });
}
