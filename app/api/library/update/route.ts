import { auth } from "@clerk/nextjs/server";
import { redis } from "@/lib/redis";

type ReadingStatus = "to-read" | "reading" | "read";
type ScreeningStatus = "include" | "exclude" | "maybe" | "unscreened";
type FullTextStatus = "pending" | "retrieved" | "unavailable" | "not-needed";

type UpdatePayload = {
  id?: string;
  favorite?: boolean;
  readingStatus?: ReadingStatus;
  notes?: string;
  tags?: string[];
  collection?: string;
  screeningStatus?: ScreeningStatus;
  exclusionReason?: string;
  fullTextStatus?: FullTextStatus;
  duplicateOf?: string;
  extraction?: Record<string, string>;
};

function cleanText(value: unknown, max = 4000) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanTags(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return Array.from(
    new Set(value.map((item) => cleanText(item, 60)).filter(Boolean))
  ).slice(0, 20);
}

export async function PATCH(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: "Sign in required." }, { status: 401 });
    }

    const body = (await request.json()) as UpdatePayload;
    const id = cleanText(body.id, 500);
    if (!id) {
      return Response.json({ error: "Missing article id." }, { status: 400 });
    }

    const key = `library:${userId}:article:${id}`;
    const current = await redis.get<Record<string, unknown>>(key);
    if (!current) {
      return Response.json({ error: "Article not found." }, { status: 404 });
    }

    const allowedReading = new Set<ReadingStatus>(["to-read", "reading", "read"]);
    const allowedScreening = new Set<ScreeningStatus>(["include", "exclude", "maybe", "unscreened"]);
    const allowedFullText = new Set<FullTextStatus>(["pending", "retrieved", "unavailable", "not-needed"]);

    const next = {
      ...current,
      ...(typeof body.favorite === "boolean" ? { favorite: body.favorite } : {}),
      ...(body.readingStatus && allowedReading.has(body.readingStatus)
        ? { readingStatus: body.readingStatus }
        : {}),
      ...(body.notes !== undefined ? { notes: cleanText(body.notes, 12000) } : {}),
      ...(body.tags !== undefined ? { tags: cleanTags(body.tags) } : {}),
      ...(body.collection !== undefined
        ? { collection: cleanText(body.collection, 120) || "Unsorted" }
        : {}),
      ...(body.screeningStatus && allowedScreening.has(body.screeningStatus)
        ? { screeningStatus: body.screeningStatus }
        : {}),
      ...(body.exclusionReason !== undefined
        ? { exclusionReason: cleanText(body.exclusionReason, 1000) }
        : {}),
      ...(body.fullTextStatus && allowedFullText.has(body.fullTextStatus)
        ? { fullTextStatus: body.fullTextStatus }
        : {}),
      ...(body.duplicateOf !== undefined
        ? { duplicateOf: cleanText(body.duplicateOf, 500) }
        : {}),
      ...(body.extraction && typeof body.extraction === "object"
        ? {
            extraction: Object.fromEntries(
              Object.entries(body.extraction)
                .slice(0, 30)
                .map(([keyName, value]) => [cleanText(keyName, 80), cleanText(value, 2000)])
                .filter(([keyName]) => Boolean(keyName))
            ),
          }
        : {}),
      updatedAt: new Date().toISOString(),
    };

    await redis.set(key, next);
    return Response.json({ success: true, article: next });
  } catch (error) {
    console.error("Library update error:", error);
    return Response.json({ error: "Failed to update library item." }, { status: 500 });
  }
}
