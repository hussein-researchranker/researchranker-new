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

function clean(value: unknown, max = 500) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function terms(value: string) {
  return clean(value)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length >= 3)
    .slice(0, 30);
}

function relevance(query: string, title: string) {
  const q = terms(query);
  const t = new Set(terms(title));
  if (!q.length) return 0;
  const matched = q.filter((term) => t.has(term)).length;
  return Math.round((matched / q.length) * 100);
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });

    const body = await request.json();
    const id = clean(body?.id, 150);
    if (!id) return Response.json({ error: "Missing saved search id." }, { status: 400 });

    const key = `saved-searches:${userId}:item:${id}`;
    const search = await redis.get<SavedSearch>(key);
    if (!search) return Response.json({ error: "Saved search not found." }, { status: 404 });

    const url = new URL("https://api.openalex.org/works");
    url.searchParams.set("search", search.query);
    url.searchParams.set("sort", "publication_date:desc");
    url.searchParams.set("per-page", "25");
    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) return Response.json({ error: "Alert check service failed." }, { status: 502 });

    const seenKey = `saved-searches:${userId}:seen:${id}`;
    const results = Array.isArray(data?.results) ? data.results : [];
    const alerts: Array<Record<string, unknown>> = [];

    for (const work of results) {
      const workId = clean(work?.id, 200);
      if (!workId) continue;
      const score = relevance(search.query, clean(work?.title, 1000));
      const seen = await redis.sismember(seenKey, workId);
      if (!seen && score >= 25) {
        const doi = clean(work?.doi, 300).replace(/^https:\/\/doi\.org\//i, "");
        alerts.push({
          id: workId,
          title: clean(work?.title, 1000),
          year: work?.publication_year ?? null,
          publicationDate: clean(work?.publication_date, 80),
          doi,
          relevanceScore: score,
          citedByCount: Number(work?.cited_by_count) || 0,
          openAccess: Boolean(work?.open_access?.is_oa),
        });
      }
      await redis.sadd(seenKey, workId);
    }

    const updated = {
      ...search,
      lastCheckedAt: new Date().toISOString(),
      lastResultCount: results.length,
    };
    await redis.set(key, updated);

    return Response.json({
      search: updated,
      alerts: alerts.sort((a, b) => Number(b.relevanceScore) - Number(a.relevanceScore)),
      threshold: 25,
      scoringNote: "Relevance score is a transparent title-token overlap heuristic used only to reduce notification noise; it is not a scientific relevance judgment.",
    });
  } catch (error) {
    console.error("Saved search check error:", error);
    return Response.json({ error: "Failed to check saved search." }, { status: 500 });
  }
}
