import { auth } from "@clerk/nextjs/server";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

type GeminiSummaryResponse = {
  objective: string;
  methodology: string;
  keyFindings: string[];
  conclusion: string;
  researchValue: string;
  limitationNote: string;
};

const GEMINI_MODEL = "gemini-2.5-flash-lite";
const MAX_ABSTRACT_CHARS = 4000;
const AI_TIMEOUT_MS = 25_000;

function cleanText(value: unknown, maxChars = 6000) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxChars);
}

function limitText(value: unknown, maxChars = MAX_ABSTRACT_CHARS) {
  const cleanValue = cleanText(value, maxChars + 1);

  if (cleanValue.length <= maxChars) {
    return cleanValue;
  }

  return `${cleanValue.slice(0, maxChars)}...`;
}

function normalizeSummary(value: Partial<GeminiSummaryResponse>): GeminiSummaryResponse {
  const keyFindings = Array.isArray(value.keyFindings)
    ? value.keyFindings.map((item) => cleanText(item, 2000)).filter(Boolean).slice(0, 5)
    : [];

  return {
    objective:
      cleanText(value.objective, 2500) ||
      "The objective was inferred from the article abstract.",
    methodology:
      cleanText(value.methodology, 2500) ||
      "The methodology was not clearly specified in the abstract.",
    keyFindings:
      keyFindings.length > 0
        ? keyFindings
        : ["The key findings could not be clearly extracted from the abstract."],
    conclusion:
      cleanText(value.conclusion, 2500) ||
      "The conclusion was not clearly specified in the abstract.",
    researchValue:
      cleanText(value.researchValue, 2500) ||
      "This article may be useful for understanding the research topic described in the abstract.",
    limitationNote:
      cleanText(value.limitationNote, 2500) ||
      "This AI summary is based only on the available title and abstract.",
  };
}

function safeParseJson(text: string): GeminiSummaryResponse {
  try {
    const cleaned = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    return normalizeSummary(JSON.parse(cleaned));
  } catch {
    return normalizeSummary({
      objective: "AI summary generated as plain text.",
      keyFindings: [cleanText(text, 5000)],
      limitationNote:
        "The AI response was not returned as structured JSON. Review manually before academic use.",
    });
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json({ error: "Sign in required." }, { status: 401 });
    }

    const rateLimit = await checkRateLimit({
      key: `ai-summary:${userId}`,
      limit: 20,
      windowSeconds: 10 * 60,
    });
    const headers = rateLimitHeaders(rateLimit);

    if (!rateLimit.allowed) {
      return Response.json(
        { error: "AI summary limit reached. Please wait before trying again." },
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
    const title = cleanText(body?.title, 1000);
    const journal = cleanText(body?.journal, 500);
    const abstract = limitText(body?.abstract || "");
    const authors = cleanText(body?.authors, 1200);
    const pubdate = cleanText(body?.pubdate, 100);

    if (!title && !abstract) {
      return Response.json(
        { error: "Missing article title or abstract." },
        { status: 400, headers }
      );
    }

    const prompt = `
You are an academic biomedical research assistant.

Extract a useful structured academic summary from the article data below.

Rules:
- Use only the title and abstract provided.
- Do not invent data, numbers, or outcomes.
- Do not answer "Not specified" unless absolutely necessary.
- If the objective is not explicitly stated, infer it from the first sentences.
- If methodology is not explicitly stated, infer the article type from wording such as review, observational, experimental, comparative, mechanistic, or clinical.
- Key findings must contain 3 meaningful points when possible.
- Conclusion must summarize the main implication.
- Research value must explain why this paper is useful for researchers.
- Limitation note must mention that the summary is based only on the available abstract when appropriate.
- Return JSON only.

Article:
Title: ${title}
Journal: ${journal}
Authors: ${authors}
Publication date: ${pubdate}
Abstract: ${abstract}
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(AI_TIMEOUT_MS),
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 900,
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                objective: { type: "string" },
                methodology: { type: "string" },
                keyFindings: {
                  type: "array",
                  items: { type: "string" },
                },
                conclusion: { type: "string" },
                researchValue: { type: "string" },
                limitationNote: { type: "string" },
              },
              required: [
                "objective",
                "methodology",
                "keyFindings",
                "conclusion",
                "researchValue",
                "limitationNote",
              ],
            },
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini summarize API error:", {
        status: response.status,
        code: data?.error?.code,
      });

      if (response.status === 429) {
        return Response.json(
          { error: "AI provider is busy. Please try again shortly." },
          { status: 429, headers }
        );
      }

      return Response.json(
        { error: "AI provider request failed. Please try again later." },
        { status: 502, headers }
      );
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!text) {
      return Response.json(
        { error: "AI returned an empty response." },
        { status: 502, headers }
      );
    }

    return Response.json(safeParseJson(text), { headers });
  } catch (error) {
    console.error("AI summarize route error:", error);

    const isTimeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");

    return Response.json(
      {
        error: isTimeout
          ? "AI request timed out. Please try again."
          : "AI summary failed because of a server error.",
      },
      { status: isTimeout ? 504 : 500 }
    );
  }
}
