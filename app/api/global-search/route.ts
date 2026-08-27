import { auth } from "@clerk/nextjs/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { GET as runGlobalSearch } from "./core";

export const runtime = "nodejs";

const GLOBAL_SEARCH_LIMIT_PER_MINUTE = 15;
const MAX_QUERY_CHARS = 500;
const GLOBAL_SEARCH_TIMEOUT_MS = 25_000;

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export async function GET(request: Request) {
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
      { error: `Query is too long. Maximum length is ${MAX_QUERY_CHARS} characters.` },
      { status: 400 }
    );
  }

  const timeoutResponse = new Promise<Response>((resolve) => {
    setTimeout(() => {
      resolve(
        Response.json(
          { error: "Global search timed out. Please try again." },
          { status: 504 }
        )
      );
    }, GLOBAL_SEARCH_TIMEOUT_MS);
  });

  return Promise.race([runGlobalSearch(request), timeoutResponse]);
}
