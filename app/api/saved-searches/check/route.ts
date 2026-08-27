import path from "path";
import { readFile } from "fs/promises";
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

type AlertRecord = {
  id: string;
  searchId: string;
  title: string;
  year: number | null;
  publicationDate: string;
  doi: string;
  relevanceScore: number;
  citedByCount: number;
  openAccess: boolean;
  quartile: string;
  detectedAt: string;
  source: "OpenAlex";
};

type OpenAlexWork = {
  id?: string;
  title?: string;
  publication_year?: number;
  publication_date?: string;
  doi?: string;
  cited_by_count?: number;
  open_access?: { is_oa?: boolean };
  primary_location?: {
    source?: {
      issn_l?: string;
      issn?: string[];
    } | null;
  } | null;
};

let quartileByIssnCache: Map<string, string> | null = null;

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

function normalizeIssn(value: unknown) {
  return clean(value, 40).replace(/[^0-9xX]/g, "").toUpperCase();
}

function parseCsvLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

async function loadQuartilesByIssn() {
  if (quartileByIssnCache) return quartileByIssnCache;

  const map = new Map<string, string>();
  try {
    const file = await readFile(path.join(process.cwd(), "public", "scimagojr.csv"), "utf8");
    const lines = file.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      quartileByIssnCache = map;
      return map;
    }

    const delimiter = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ";" : ",";
    const headers = parseCsvLine(lines[0], delimiter).map((value) => clean(value).replace(/^\uFEFF/, ""));
    const issnIndex = headers.findIndex((header) => ["issn", "issns"].includes(header.toLowerCase()));
    const quartileIndex = headers.findIndex((header) =>
      ["sjr best quartile", "best quartile", "quartile"].includes(header.toLowerCase())
    );

    if (issnIndex < 0 || quartileIndex < 0) {
      quartileByIssnCache = map;
      return map;
    }

    for (const line of lines.slice(1)) {
      const values = parseCsvLine(line, delimiter);
      const quartile = clean(values[quartileIndex], 10).toUpperCase();
      if (!/^Q[1-4]$/.test(quartile)) continue;
      clean(values[issnIndex], 200)
        .split(/[,; ]+/)
        .map(normalizeIssn)
        .filter(Boolean)
        .forEach((issn) => map.set(issn, quartile));
    }
  } catch (error) {
    console.error("Saved-search quartile map error:", error);
  }

  quartileByIssnCache = map;
  return map;
}

function workIssns(work: OpenAlexWork) {
  const source = work.primary_location?.source;
  return Array.from(
    new Set(
      [source?.issn_l || "", ...(Array.isArray(source?.issn) ? source.issn : [])]
        .map(normalizeIssn)
        .filter(Boolean)
    )
  );
}

async function verifiedQuartile(work: OpenAlexWork, quartileMap: Map<string, string>) {
  for (const issn of workIssns(work)) {
    const quartile = quartileMap.get(issn);
    if (quartile) return quartile;
  }
  return "";
}

function alertIndexKey(userId: string, searchId: string) {
  return `saved-searches:${userId}:alerts:${searchId}:ids`;
}

function alertKey(userId: string, searchId: string, workId: string) {
  return `saved-searches:${userId}:alert:${searchId}:${Buffer.from(workId).toString("base64url")}`;
}

async function loadPersistedAlerts(userId: string, searchId: string) {
  const ids = (await redis.smembers(alertIndexKey(userId, searchId))) as string[];
  if (!Array.isArray(ids) || ids.length === 0) return [] as AlertRecord[];

  const values = (await redis.mget(
    ...ids.slice(0, 100).map((workId) => alertKey(userId, searchId, workId))
  )) as Array<AlertRecord | null>;

  return values
    .filter((item): item is AlertRecord => Boolean(item))
    .sort((a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt));
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });

    const id = clean(new URL(request.url).searchParams.get("id"), 150);
    if (!id) return Response.json({ error: "Missing saved search id." }, { status: 400 });

    const search = await redis.get<SavedSearch>(`saved-searches:${userId}:item:${id}`);
    if (!search) return Response.json({ error: "Saved search not found." }, { status: 404 });

    return Response.json({ alerts: await loadPersistedAlerts(userId, id) });
  } catch (error) {
    console.error("Load saved-search alerts error:", error);
    return Response.json({ error: "Failed to load saved-search alerts." }, { status: 500 });
  }
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
    if (!search.alertEnabled) {
      return Response.json({ error: "Alerts are disabled for this saved search." }, { status: 409 });
    }

    const url = new URL("https://api.openalex.org/works");
    url.searchParams.set("search", search.query);
    url.searchParams.set("sort", "publication_date:desc");
    url.searchParams.set("per-page", "50");
    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) return Response.json({ error: "Alert check service failed." }, { status: 502 });

    const results = (Array.isArray(data?.results) ? data.results : []) as OpenAlexWork[];
    const seenKey = `saved-searches:${userId}:seen:${id}`;
    const initialized = !search.lastCheckedAt;
    const newAlerts: AlertRecord[] = [];
    const quartileMap = search.quartile === "All" ? new Map<string, string>() : await loadQuartilesByIssn();

    for (const work of results) {
      const workId = clean(work.id, 300);
      if (!workId) continue;

      const seen = await redis.sismember(seenKey, workId);
      const score = relevance(search.query, clean(work.title, 1000));
      const quartile = search.quartile === "All" ? "" : await verifiedQuartile(work, quartileMap);
      const quartileMatches = search.quartile === "All" || quartile === search.quartile;

      if (!initialized && !seen && score >= 25 && quartileMatches) {
        const record: AlertRecord = {
          id: workId,
          searchId: id,
          title: clean(work.title, 1000),
          year: Number(work.publication_year) || null,
          publicationDate: clean(work.publication_date, 80),
          doi: clean(work.doi, 300).replace(/^https:\/\/doi\.org\//i, ""),
          relevanceScore: score,
          citedByCount: Number(work.cited_by_count) || 0,
          openAccess: Boolean(work.open_access?.is_oa),
          quartile,
          detectedAt: new Date().toISOString(),
          source: "OpenAlex",
        };
        await redis.set(alertKey(userId, id, workId), record);
        await redis.sadd(alertIndexKey(userId, id), workId);
        newAlerts.push(record);
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
      initialized,
      newCount: newAlerts.length,
      newAlerts: newAlerts.sort((a, b) => b.relevanceScore - a.relevanceScore),
      alerts: await loadPersistedAlerts(userId, id),
      threshold: 25,
      scoringNote:
        "Relevance score is a transparent title-token overlap heuristic used only to reduce notification noise; it is not a scientific relevance judgment.",
      baselineNote: initialized
        ? "The first check establishes a baseline and does not label existing papers as new."
        : undefined,
      quartileNote:
        search.quartile === "All"
          ? "No quartile filter was requested."
          : `Only works whose source ISSN maps to ${search.quartile} in the local SCImago snapshot are eligible for alerts.`,
    });
  } catch (error) {
    console.error("Saved search check error:", error);
    return Response.json({ error: "Failed to check saved search." }, { status: 500 });
  }
}
