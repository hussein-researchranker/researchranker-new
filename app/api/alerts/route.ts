import { auth } from "@clerk/nextjs/server";
import { redis } from "@/lib/redis";
import { cleanText, type SearchAlert } from "@/lib/research-types";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });

  const ids = (await redis.smembers(`alerts:${userId}:ids`)) as string[];
  if (!ids.length) return Response.json({ alerts: [] });

  const values = await redis.mget(...ids.map((id) => `alerts:${userId}:${id}`));
  const alerts = values
    .map((value) => {
      if (!value) return null;
      return typeof value === "string" ? (JSON.parse(value) as SearchAlert) : (value as SearchAlert);
    })
    .filter((value): value is SearchAlert => Boolean(value))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return Response.json({ alerts });
}

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });

  const body = await request.json();
  const id = cleanText(body?.id);
  if (!id) return Response.json({ error: "Missing alert id." }, { status: 400 });

  const key = `alerts:${userId}:${id}`;
  const raw = await redis.get(key);
  if (!raw) return Response.json({ error: "Alert not found." }, { status: 404 });

  const alert = typeof raw === "string" ? (JSON.parse(raw) as SearchAlert) : (raw as SearchAlert);
  alert.read = body?.read !== false;
  await redis.set(key, alert);
  return Response.json({ success: true, alert });
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const id = cleanText(body?.id);

  if (id) {
    await redis.del(`alerts:${userId}:${id}`);
    await redis.srem(`alerts:${userId}:ids`, id);
    return Response.json({ success: true });
  }

  const ids = (await redis.smembers(`alerts:${userId}:ids`)) as string[];
  if (ids.length) {
    await redis.del(...ids.map((alertId) => `alerts:${userId}:${alertId}`));
    await redis.del(`alerts:${userId}:ids`);
  }
  return Response.json({ success: true });
}
