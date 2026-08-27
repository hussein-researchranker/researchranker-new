import { auth } from "@clerk/nextjs/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyJournal } from "@/lib/journal-verification";

export const runtime = "nodejs";

const MAX_TITLE_CHARS = 300;
const JOURNAL_VERIFY_LIMIT_PER_MINUTE = 30;

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: "You must sign in to verify journal data." },
        { status: 401 }
      );
    }

    const rateLimit = await checkRateLimit({
      key: `journal-verify:${userId}`,
      limit: JOURNAL_VERIFY_LIMIT_PER_MINUTE,
      windowSeconds: 60,
    });

    if (!rateLimit.success) {
      return Response.json(
        {
          error: "Journal verification rate limit reached. Please try again shortly.",
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    const { searchParams } = new URL(request.url);
    const issn = cleanText(searchParams.get("issn"));
    const title = cleanText(searchParams.get("title"));

    if (!issn && !title) {
      return Response.json(
        { error: "Provide an ISSN or journal title." },
        { status: 400 }
      );
    }

    if (title.length > MAX_TITLE_CHARS) {
      return Response.json(
        { error: `Journal title is too long. Maximum length is ${MAX_TITLE_CHARS} characters.` },
        { status: 400 }
      );
    }

    const result = await verifyJournal({ issn, title });

    return Response.json(result, {
      headers: {
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Journal verification API error:", error);
    return Response.json(
      { error: "Journal verification failed because of a server error." },
      { status: 500 }
    );
  }
}
