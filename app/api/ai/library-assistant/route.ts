import { auth } from "@clerk/nextjs/server";
import { redis } from "@/lib/redis";

const MODEL = "gemini-2.5-flash-lite";

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
    if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return Response.json({ error: "AI service is not configured." }, { status: 503 });

    const body = await request.json();
    const question = cleanText(body?.question, 1200);
    const ids = Array.isArray(body?.articleIds)
      ? body.articleIds.map((id: unknown) => cleanText(id, 500)).filter(Boolean).slice(0, 20)
      : [];

    if (!question) return Response.json({ error: "Question is required." }, { status: 400 });
    if (ids.length === 0) return Response.json({ error: "Select at least one library article." }, { status: 400 });

    const values = (await redis.mget(
      ...ids.map((id: string) => `library:${userId}:article:${id}`)
    )) as Array<LibraryArticle | null>;
    const articles = values.filter((item): item is LibraryArticle => Boolean(item));
    if (articles.length === 0) return Response.json({ error: "Selected articles were not found." }, { status: 404 });

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
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.05, maxOutputTokens: 1800 },
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error("Library assistant Gemini error:", data);
      return Response.json({ error: data?.error?.message || "AI request failed." }, { status: response.status });
    }

    const answer = cleanText(data?.candidates?.[0]?.content?.parts?.[0]?.text, 18000);
    if (!answer) return Response.json({ error: "AI returned an empty response." }, { status: 500 });

    return Response.json({
      answer,
      sources: articles.map((article, index) => ({
        id: `S${index + 1}`,
        articleId: article.id,
        title: article.title,
        doi: article.doi,
      })),
      grounded: true,
    });
  } catch (error) {
    console.error("Library assistant error:", error);
    return Response.json({ error: "Failed to answer from the selected sources." }, { status: 500 });
  }
}
