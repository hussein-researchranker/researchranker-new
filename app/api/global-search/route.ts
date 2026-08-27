import { auth } from "@clerk/nextjs/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { GET as runGlobalSearch } from "./core";

export const runtime = "nodejs";

const GLOBAL_SEARCH_LIMIT_PER_MINUTE = 15;
const MAX_QUERY_CHARS = 500;
const MAX_RESULTS = 50;
const MIN_YEAR = 1900;
const GLOBAL_SEARCH_TIMEOUT_MS = 25_000;

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parseInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: "You must sign in to use global search." },
        { status: 401 }
      );
    }

    const rateLimit = await checkRateLimit({
      key: `global-search:${userId}`,
      limit: GLOBAL_SEARCH_LIMIT_PER_MINUTE,
      windowSeconds: 60,
    });

    if (!rateLimit.success) {
      return Response.json(
        {
          error: "Global search rate limit reached. Please try again shortly.",
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    const url = new URL(request.url);
    const query = cleanText(
      url.searchParams.get("query") || url.searchParams.get("q") || ""
    );

    if (!query) {
      return Response.json(
        { error: "Missing query parameter." },
        { status: 400 }
      );
    }

    if (query.length > MAX_QUERY_CHARS) {
      return Response.json(
        {
          error: `Query is too long. Maximum length is ${MAX_QUERY_CHARS} characters.`,
        },
        { status: 400 }
      );
    }

    const currentYear = new Date().getFullYear();
    const fromYear = parseInteger(url.searchParams.get("fromYear"), 1990);
    const toYear = parseInteger(url.searchParams.get("toYear"), currentYear);

    if (
      fromYear < MIN_YEAR ||
      toYear > currentYear + 1 ||
      fromYear > toYear
    ) {
      return Response.json(
        { error: "Invalid publication year range." },
        { status: 400 }
      );
    }

    const requestedMaxResults = parseInteger(
      url.searchParams.get("maxResults"),
      MAX_RESULTS
    );
    url.searchParams.set(
      "maxResults",
      String(Math.min(Math.max(requestedMaxResults, 1), MAX_RESULTS))
    );

    const sanitizedRequest = new Request(url.toString(), {
      method: "GET",
      headers: request.headers,
    });

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const timeoutResponse = new Promise<Response>((resolve) => {
      timeoutId = setTimeout(() => {
        resolve(
          Response.json(
            { error: "Global search timed out. Please try again." },
            { status: 504 }
          )
        );
      }, GLOBAL_SEARCH_TIMEOUT_MS);
    });

    const response = await Promise.race([
      runGlobalSearch(sanitizedRequest),
      timeoutResponse,
    ]);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    return response;
  } catch (error) {
    console.error("Global search security wrapper error:", error);

    return Response.json(
      { error: "Global search failed because of a server error." },
      { status: 500 }
    );
  }
}
