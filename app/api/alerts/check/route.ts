import { auth } from "@clerk/nextjs/server";
import { redis } from "@/lib/redis";
import { cleanText, type SavedSearch, type SearchAlert } from "@/lib/research-types";

type SearchArticle = {
  id?: string;
  pmid?: string;
  title?: string;
  journal?: string;
  doi?: string;
  pubdate?: string;
  abstract?: string;
  quartile?: string;
};

function articleKey(article: SearchArticle) {
  return cleanText(article.doi || article.pmid || article.id || article.title).toLowerCase();
}

function relevanceScore(query: string, article: SearchArticle) {
  const queryTokens = Array.from(
    new Set(
      cleanText(query)
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((token) => token.length > 2)
    )
  );
  if (!queryTokens.length) return 0;

  const title = cleanText(article.title).toLowerCase();
  const abstract = cleanText(article.abstract).toLowerCase();
  const haystack = `${title} ${abstract}`;
  const hits = queryTokens.filter((token) => haystack.includes(token)).length;
  const titleHits = queryTokens.filter((token) => title.includes(token)).length;
  return Math.min(100, Math.round((hits / queryTokens.length) * 70 + (titleHits / queryTokens.length) * 30));
}

function alertId(searchId: string, key: string) {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return `alert_${searchId}_${hash.toString(36)}`;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });

  const ids = (await redis.smembers(`saved-searches:${userId}:ids`)) as string[];
  if (!ids.length) return Response.json({ checked: 0, created: 0 });

  const values = await redis.mget(...ids.map((id) => `saved-searches:${userId}:${id}`));
  const searches = values
    .map((value) => {
      if (!value) return null;
      return typeof value === "string" ? (JSON.parse(value) as SavedSearch) : (value as SavedSearch);
    })
    .filter((value): value is SavedSearch => Boolean(value?.enabled));

  let created = 0;
  const origin = new URL(request.url).origin;

  for (const savedSearch of searches.slice(0, 12)) {
    const params = new URLSearchParams({
      query: savedSearch.query,
      fromYear: "1990",
      toYear: String(new Date().getFullYear()),
      maxResults: "25",
      field: savedSearch.field || "all",
    });

    try {
      const response = await fetch(`${origin}/api/global-search?${params.toString()}`, {
        cache: "no-store",
        headers: { "x-researchranker-internal": "alerts" },
      });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data)) continue;

      const articles = data as SearchArticle[];
      const currentKeys = articles.map(articleKey).filter(Boolean).slice(0, 50);
      const previous = new Set(savedSearch.lastSeenKeys || []);
      const firstCheck = previous.size === 0;

      if (!firstCheck) {
        for (const article of articles) {
          const key = articleKey(article);
          if (!key || previous.has(key)) continue;

          const score = relevanceScore(savedSearch.query, article);
          if (score < 35) continue;

          const id = alertId(savedSearch.id, key);
          const alert: SearchAlert = {
            id,
            savedSearchId: savedSearch.id,
            articleKey: key,
            title: cleanText(article.title) || "Untitled article",
            journal: cleanText(article.journal),
            doi: cleanText(article.doi),
            pubdate: cleanText(article.pubdate),
            relevanceScore: score,
            createdAt: new Date().toISOString(),
            read: false,
          };

          await redis.set(`alerts:${userId}:${id}`, alert);
          await redis.sadd(`alerts:${userId}:ids`, id);
          created += 1;
        }
      }

      savedSearch.lastSeenKeys = currentKeys;
      savedSearch.lastCheckedAt = new Date().toISOString();
      savedSearch.updatedAt = savedSearch.lastCheckedAt;
      await redis.set(`saved-searches:${userId}:${savedSearch.id}`, savedSearch);
    } catch (error) {
      console.error("Saved-search check failed:", savedSearch.id, error);
    }
  }

  return Response.json({ checked: searches.length, created });
}
