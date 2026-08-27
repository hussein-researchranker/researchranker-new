import { auth } from "@clerk/nextjs/server";
import { redis } from "@/lib/redis";
import {
  cleanText,
  normalizeLibraryArticle,
  type LibraryArticle,
  type ReadingStatus,
  type ScreeningStatus,
} from "@/lib/research-types";

const readingStatuses = new Set<ReadingStatus>(["to-read", "reading", "read"]);
const screeningStatuses = new Set<ScreeningStatus>([
  "unscreened",
  "include",
  "exclude",
  "maybe",
]);

function uniqueStrings(value: unknown, limit = 20) {
  if (!Array.isArray(value)) return undefined;
  return Array.from(new Set(value.map(cleanText).filter(Boolean))).slice(0, limit);
}

export async function PATCH(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: "Sign in required." }, { status: 401 });
    }

    const body = (await request.json()) as Partial<LibraryArticle> & { id?: string };
    const id = cleanText(body.id);
    if (!id) {
      return Response.json({ error: "Missing article id." }, { status: 400 });
    }

    const key = `library:${userId}:article:${id}`;
    const current = normalizeLibraryArticle(await redis.get(key));
    if (!current) {
      return Response.json({ error: "Article not found." }, { status: 404 });
    }

    const tags = uniqueStrings(body.tags);
    const collectionIds = uniqueStrings(body.collectionIds);
    const readingStatus = cleanText(body.readingStatus) as ReadingStatus;
    const screeningStatus = cleanText(body.screeningStatus) as ScreeningStatus;

    const extraction =
      body.extraction && typeof body.extraction === "object"
        ? Object.fromEntries(
            Object.entries(body.extraction)
              .slice(0, 30)
              .map(([field, value]) => [cleanText(field), cleanText(value)])
              .filter(([field]) => Boolean(field))
          )
        : undefined;

    const next: LibraryArticle = {
      ...current,
      ...(tags ? { tags } : {}),
      ...(collectionIds ? { collectionIds } : {}),
      ...(typeof body.notes === "string" ? { notes: cleanText(body.notes) } : {}),
      ...(typeof body.favorite === "boolean" ? { favorite: body.favorite } : {}),
      ...(readingStatuses.has(readingStatus) ? { readingStatus } : {}),
      ...(screeningStatuses.has(screeningStatus) ? { screeningStatus } : {}),
      ...(typeof body.screeningReason === "string"
        ? { screeningReason: cleanText(body.screeningReason) }
        : {}),
      ...(extraction ? { extraction } : {}),
      updatedAt: new Date().toISOString(),
    };

    await redis.set(key, next);
    return Response.json({ success: true, article: next });
  } catch (error) {
    console.error("Update library article error:", error);
    return Response.json({ error: "Failed to update article." }, { status: 500 });
  }
}
