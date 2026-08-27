import { auth } from "@clerk/nextjs/server";
import { redis } from "@/lib/redis";
import { cleanText, normalizeLibraryArticle, type LibraryArticle } from "@/lib/research-types";

const GEMINI_MODEL = "gemini-2.5-flash-lite";
const MAX_SOURCES = 15;

function sourceText(article: LibraryArticle, index: number) {
  const abstract = cleanText(article.abstract).slice(0, 4500);
  return [
    `[S${index + 1}]`,
    `Title: ${cleanText(article.title)}`,
    `Authors: ${cleanText(article.authors)}`,
    `Journal: ${cleanText(article.journal)}`,
    `Date: ${cleanText(article.pubdate)}`,
    `DOI: ${cleanText(article.doi)}`,
    `Abstract: ${abstract || "Abstract unavailable"}`,
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return Response.json({ error: "AI service is not configured." }, { status: 503 });

    const body = await request.json();
    const question = cleanText(body?.question).slice(0, 1200);
    const ids = Array.isArray(body?.articleIds)
      ? Array.from(new Set(body.articleIds.map(cleanText).filter(Boolean))).slice(0, MAX_SOURCES)
      : [];

    if (!question) return Response.json({ error: "Question is required." }, { status: 400 });
    if (!ids.length) return Response.json({ error: "Select at least one library source." }, { status: 400 });

    const values = await redis.mget(...ids.map((id) => `library:${userId}:article:${id}`));
    const articles = values
      .map(normalizeLibraryArticle)
      .filter((article): article is LibraryArticle => Boolean(article));

    if (!articles.length) return Response.json({ error: "Selected sources were not found." }, { status: 404 });

    const sources = articles.map(sourceText).join("\n\n---\n\n");
    const prompt = `You are a rigorous academic research assistant. Answer the researcher's question using ONLY the supplied sources.

STRICT RULES:
1. Do not use outside knowledge.
2. Every factual claim must end with one or more source markers like [S1] or [S2][S4].
3. If the sources do not support an answer, state that the evidence provided is insufficient.
4. Do not invent sample sizes, outcomes, effect sizes, methods, or conclusions.
5. Distinguish disagreement or uncertainty between studies.
6. The answer should synthesize evidence, not merely list abstracts.
7. Return JSON only with: answer, evidenceGaps, sourceIdsUsed.

Question: ${question}

Sources:
${sources}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.05,
            maxOutputTokens: 1800,
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                answer: { type: "string" },
                evidenceGaps: { type: "array", items: { type: "string" } },
                sourceIdsUsed: { type: "array", items: { type: "string" } },
              },
              required: ["answer", "evidenceGaps", "sourceIdsUsed"],
            },
          },
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      return Response.json(
        { error: data?.error?.message || "AI assistant request failed." },
        { status: response.status }
      );
    }

    const text = cleanText(data?.candidates?.[0]?.content?.parts?.[0]?.text);
    if (!text) return Response.json({ error: "AI assistant returned an empty response." }, { status: 502 });

    let parsed: { answer?: string; evidenceGaps?: string[]; sourceIdsUsed?: string[] };
    try {
      parsed = JSON.parse(text.replace(/```json|```/gi, "").trim());
    } catch {
      parsed = { answer: text, evidenceGaps: ["Structured response parsing failed."], sourceIdsUsed: [] };
    }

    return Response.json({
      answer: cleanText(parsed.answer),
      evidenceGaps: Array.isArray(parsed.evidenceGaps) ? parsed.evidenceGaps.map(cleanText).filter(Boolean) : [],
      sourceIdsUsed: Array.isArray(parsed.sourceIdsUsed) ? parsed.sourceIdsUsed.map(cleanText).filter(Boolean) : [],
      sources: articles.map((article, index) => ({
        marker: `S${index + 1}`,
        id: article.id,
        title: article.title,
        doi: article.doi,
        journal: article.journal,
      })),
      grounding: "library-only",
    });
  } catch (error) {
    console.error("Library assistant error:", error);
    return Response.json({ error: "AI assistant failed." }, { status: 500 });
  }
}
