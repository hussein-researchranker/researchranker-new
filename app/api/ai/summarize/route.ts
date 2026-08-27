import { auth } from "@clerk/nextjs/server";
import { checkRateLimit } from "@/lib/rate-limit";

type GeminiSummaryResponse = {
  objective: string;
  methodology: string;
  keyFindings: string[];
  conclusion: string;
  researchValue: string;
  limitationNote: string;
};

const GEMINI_MODEL = "gemini-2.5-flash-lite";
const MAX_ABSTRACT_CHARS = 3000;
const MAX_TITLE_CHARS = 500;
const MAX_JOURNAL_CHARS = 300;
const MAX_AUTHORS_CHARS = 1200;
const MAX_PUBDATE_CHARS = 100;
const GEMINI_TIMEOUT_MS = 15_000;
const SUMMARY_LIMIT_PER_MINUTE = 20;

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function limitText(value: unknown, maxChars: number) {
  const cleanValue = cleanText(value);

  if (cleanValue.length <= maxChars) {
    return cleanValue;
  }

  return `${cleanValue.slice(0, maxChars)}...`;
}

function normalizeSummary(
  value: Partial<GeminiSummaryResponse>
): GeminiSummaryResponse {
  const keyFindings = Array.isArray(value.keyFindings)
    ? value.keyFindings.map(cleanText).filter(Boolean).slice(0, 5)
    : [];

  return {
    objective:
      cleanText(value.objective) ||
      "The objective was inferred from the article abstract.",
    methodology:
      cleanText(value.methodology) ||
      "The methodology was not clearly specified in the abstract.",
    keyFindings:
      keyFindings.length > 0
        ? keyFindings
        : [
            "The key findings could not be clearly extracted from the abstract.",
          ],
    conclusion:
      cleanText(value.conclusion) ||
      "The conclusion was not clearly specified in the abstract.",
    researchValue:
      cleanText(value.researchValue) ||
      "This article may be useful for understanding the research topic described in the abstract.",
    limitationNote:
      cleanText(value.limitationNote) ||
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
      keyFindings: [text],
      limitationNote:
        "The AI response was not returned as structured JSON. Review manually before academic use.",
    });
  }
}

function isTimeoutError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: "You must sign in to use AI summaries." },
        { status: 401 }
      );
    }

    const rateLimit = await checkRateLimit({
      key: `ai-summary:${userId}`,
      limit: SUMMARY_LIMIT_PER_MINUTE,
      windowSeconds: 60,
    });

    if (!rateLimit.success) {
      return Response.json(
        {
          error:
            "AI summary rate limit reached. Please wait before trying again.",
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

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          error:
            "Missing GEMINI_API_KEY. Add it in Vercel Environment Variables and redeploy.",
        },
        { status: 500 }
      );
    }

    const body = await request.json();

    const title = limitText(body?.title, MAX_TITLE_CHARS);
    const journal = limitText(body?.journal, MAX_JOURNAL_CHARS);
    const abstract = limitText(body?.abstract, MAX_ABSTRACT_CHARS);
    const authors = limitText(body?.authors, MAX_AUTHORS_CHARS);
    const pubdate = limitText(body?.pubdate, MAX_PUBDATE_CHARS);

    if (!title && !abstract) {
      return Response.json(
        {
          error: "Missing article title or abstract.",
        },
        { status: 400 }
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
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const status = response.status;
      const message =
        data?.error?.message ||
        "Gemini request failed. Please try again later.";

      console.error("Gemini API error:", data);

      if (status === 429) {
        return Response.json(
          {
            error:
              "Gemini rate limit reached. Please wait a few minutes and try again.",
          },
          { status: 429 }
        );
      }

      if (status === 401 || status === 403) {
        return Response.json(
          {
            error:
              "Gemini API key is invalid or not authorized. Check GEMINI_API_KEY in Vercel.",
          },
          { status }
        );
      }

      return Response.json(
        {
          error: message,
        },
        { status }
      );
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!text) {
      return Response.json(
        {
          error: "Gemini returned an empty response.",
        },
        { status: 500 }
      );
    }

    const summary = safeParseJson(text);

    return Response.json(summary);
  } catch (error) {
    console.error("AI summarize route error:", error);

    if (isTimeoutError(error)) {
      return Response.json(
        {
          error: "AI summary timed out. Please try again.",
        },
        { status: 504 }
      );
    }

    return Response.json(
      {
        error: "AI summary failed because of a server error.",
      },
      { status: 500 }
    );
  }
}
