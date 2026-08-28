import { auth } from "@clerk/nextjs/server";
import { redis } from "@/lib/redis";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

const MODEL = "gemini-2.5-flash-lite";
const AI_TIMEOUT_MS = 30_000;

type LibraryArticle = {
  id?: string;
  title?: string;
  authors?: string;
  journal?: string;
  pubdate?: string;
  doi?: string;
  abstract?: string;
};

function cleanText(value: unknown, max = 8000) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: "Sign in required." }, { status: 401 });
    }

    const rateLimit = await checkRateLimit({
      key: `ai-library:${userId}`,
      limit: 15,
      windowSeconds: 10 * 60,
    });
    const headers = rateLimitHeaders(rateLimit);

    if (!rateLimit.allowed) {
      return Response.json(
        { error: "AI assistant limit reached. Please wait before trying again." },
        { status: 429, headers }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "AI service is temporarily unavailable." },
        { status: 503, headers }
      );
    }

    const body = await request.json();
    const question = cleanText(body?.question, 1200);
    const ids = Array.isArray(body?.articleIds)
      ? body.articleIds
          .map((id: unknown) => cleanText(id, 500))
          .filter(Boolean)
          .slice(0, 20)
      : [];

    if (!question) {
      return Response.json(
        { error: "Question is required." },
        { status: 400, headers }
      );
    }
    if (ids.length === 0) {
      return Response.json(
        { error: "Select at least one library article." },
        { status: 400, headers }
      );
    }

    const values = (await redis.mget(
      ...ids.map((id: string) => `library:${userId}:article:${id}`)
    )) as Array<LibraryArticle | null>;
    const articles = values.filter((item): item is LibraryArticle => Boolean(item));

    if (articles.length === 0) {
      return Response.json(
        { error: "Selected articles were not found." },
        { status: 404, headers }
      );
    }

    const sources = articles.map((article, index) => {
      const sourceId = `S${index + 1}`;
      return `[${sourceId}]\nTitle: ${cleanText(article.title, 500)}\nAuthors: ${cleanText(article.authors, 500)}\nJournal: ${cleanText(article.journal, 300)}\nDate: ${cleanText(article.pubdate, 100)}\nDOI: ${cleanText(article.doi, 200)}\nAbstract: ${cleanText(article.abstract, 5000) || "No abstract available"}`;
    });

    const prompt = `You are a rigorous academic research assistant. Answer the user's question using ONLY the supplied sources.\n\nRules:\n- Do not use outside knowledge.\n- Every substantive claim must end with one or more source citations in the form [S1] or [S2][S4].\n- If the sources do not support a claim, say so explicitly.\n- Distinguish agreement, disagreement, methods, and limitations when relevant.\n- Never invent sample sizes, effect sizes, statistics, mechanisms, or conclusions.\n- Prefer concise synthesis over one-paper-at-a-time summaries.\n- Answer in the same language as the user's question.\n\nQuestion: ${question}\n\nSources:\n${sources.join("\n\n")}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(AI_TIMEOUT_MS),
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.05, maxOutputTokens: 1800 },
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error("Library assistant Gemini error:", {
        status: response.status,
        code: data?.error?.code,
      });

      return Response.json(
        {
          error:
            response.status === 429
              ? "AI provider is busy. Please try again shortly."
              : "AI provider request failed. Please try again later.",
        },
        { status: response.status === 429 ? 429 : 502, headers }
      );
    }

    const answer = cleanText(
      data?.candidates?.[0]?.content?.parts?.[0]?.text,
      18000
    );
    if (!answer) {
      return Response.json(
        { error: "AI returned an empty response." },
        { status: 502, headers }
      );
    }

    return Response.json(
      {
        answer,
        sources: articles.map((article, index) => ({
          id: `S${index + 1}`,
          articleId: article.id,
          title: article.title,
          doi: article.doi,
        })),
        grounded: true,
      },
      { headers }
    );
  } catch (error) {
    console.error("Library assistant error:", error);

    const isTimeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");

    return Response.json(
      {
        error: isTimeout
          ? "AI request timed out. Please try again."
          : "Failed to answer from the selected sources.",
      },
      { status: isTimeout ? 504 : 500 }
    );
  }
}
