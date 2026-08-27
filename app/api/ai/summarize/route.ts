import { auth } from "@clerk/nextjs/server";
import { checkRateLimit } from "@/lib/rate-limit";

type GeminiSummaryResponse = {
  objective: string;
  methodology: string;
  keyFindings: string[];
  conclusion: string;
  researchValue: string;
  limitationNote: string;
  evidenceBasis: "abstract" | "title-only" | "insufficient";
  evidenceNotes: string[];
};

const GEMINI_MODEL = "gemini-2.5-flash-lite";
const MAX_ABSTRACT_CHARS = 5000;
const MAX_TITLE_CHARS = 500;
const MAX_JOURNAL_CHARS = 300;
const MAX_AUTHORS_CHARS = 1200;
const MAX_PUBDATE_CHARS = 100;
const GEMINI_TIMEOUT_MS = 15_000;
const SUMMARY_LIMIT_PER_MINUTE = 20;
const MIN_ABSTRACT_CHARS_FOR_AI_SUMMARY = 80;

const NOT_REPORTED = "Not reported in the available title/abstract.";

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function limitText(value: unknown, maxChars: number) {
  const cleanValue = cleanText(value);
  return cleanValue.length <= maxChars
    ? cleanValue
    : `${cleanValue.slice(0, maxChars)}...`;
}

function conservativeSummary(
  evidenceBasis: GeminiSummaryResponse["evidenceBasis"],
  limitation: string
): GeminiSummaryResponse {
  return {
    objective: NOT_REPORTED,
    methodology: NOT_REPORTED,
    keyFindings: [NOT_REPORTED],
    conclusion: NOT_REPORTED,
    researchValue:
      evidenceBasis === "title-only"
        ? "The title identifies the article topic, but the available metadata is insufficient for a reliable scientific summary."
        : "The available metadata is insufficient for a reliable scientific summary.",
    limitationNote: limitation,
    evidenceBasis,
    evidenceNotes: [limitation],
  };
}

function normalizeSummary(
  value: Partial<GeminiSummaryResponse>
): GeminiSummaryResponse {
  const keyFindings = Array.isArray(value.keyFindings)
    ? value.keyFindings.map(cleanText).filter(Boolean).slice(0, 5)
    : [];
  const evidenceNotes = Array.isArray(value.evidenceNotes)
    ? value.evidenceNotes.map(cleanText).filter(Boolean).slice(0, 6)
    : [];
  const evidenceBasis =
    value.evidenceBasis === "title-only" ||
    value.evidenceBasis === "insufficient"
      ? value.evidenceBasis
      : "abstract";

  return {
    objective: cleanText(value.objective) || NOT_REPORTED,
    methodology: cleanText(value.methodology) || NOT_REPORTED,
    keyFindings: keyFindings.length > 0 ? keyFindings : [NOT_REPORTED],
    conclusion: cleanText(value.conclusion) || NOT_REPORTED,
    researchValue:
      cleanText(value.researchValue) ||
      "Research value cannot be established reliably from the available metadata.",
    limitationNote:
      cleanText(value.limitationNote) ||
      "This summary is constrained to the supplied title and abstract and must not be treated as a full-text assessment.",
    evidenceBasis,
    evidenceNotes:
      evidenceNotes.length > 0
        ? evidenceNotes
        : ["No explicit evidence notes were returned by the model."],
  };
}

function safeParseJson(text: string): GeminiSummaryResponse | null {
  try {
    const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    return normalizeSummary(JSON.parse(cleaned));
  } catch {
    return null;
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

    const body = await request.json();
    const title = limitText(body?.title, MAX_TITLE_CHARS);
    const journal = limitText(body?.journal, MAX_JOURNAL_CHARS);
    const abstract = limitText(body?.abstract, MAX_ABSTRACT_CHARS);
    const authors = limitText(body?.authors, MAX_AUTHORS_CHARS);
    const pubdate = limitText(body?.pubdate, MAX_PUBDATE_CHARS);

    if (!title && !abstract) {
      return Response.json(
        { error: "Missing article title or abstract." },
        { status: 400 }
      );
    }

    if (abstract.length < MIN_ABSTRACT_CHARS_FOR_AI_SUMMARY) {
      return Response.json(
        conservativeSummary(
          title ? "title-only" : "insufficient",
          "A sufficiently detailed abstract is not available. ResearchRanker did not ask the AI to infer methods, findings, or conclusions from the title alone."
        )
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

    const prompt = `
You are an evidence-constrained academic research summarizer.

Summarize ONLY information explicitly supported by the supplied title and abstract. This is not a full-text article.

Non-negotiable rules:
- Never invent, estimate, extrapolate, or infer sample size, study design, population, intervention, comparator, biomarkers, numerical results, statistical significance, effect direction, mechanism, or conclusion.
- If a requested element is not explicitly supported, write exactly: "${NOT_REPORTED}"
- Do not infer methodology merely from the topic or journal.
- Do not convert associations into causation.
- Do not turn background statements into study findings.
- Do not claim a finding unless the abstract states it as a result or conclusion.
- Keep numbers exactly as supplied. Do not calculate new statistics.
- keyFindings may contain fewer than three items. Accuracy is more important than completeness.
- evidenceNotes must briefly identify which portions of the abstract support the summary, using paraphrases rather than fabricated quotations.
- limitationNote must state that the summary is based only on the supplied title and abstract.
- Return JSON only.

Article metadata:
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 1100,
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
                evidenceBasis: {
                  type: "string",
                  enum: ["abstract", "title-only", "insufficient"],
                },
                evidenceNotes: {
                  type: "array",
                  items: { type: "string" },
                },
              },
              required: [
                "objective",
                "methodology",
                "keyFindings",
                "conclusion",
                "researchValue",
                "limitationNote",
                "evidenceBasis",
                "evidenceNotes",
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

      return Response.json({ error: message }, { status });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!text) {
      return Response.json(
        conservativeSummary(
          "insufficient",
          "The AI provider returned no structured summary. ResearchRanker did not substitute an inferred summary."
        )
      );
    }

    const summary = safeParseJson(text);
    if (!summary) {
      return Response.json(
        conservativeSummary(
          "insufficient",
          "The AI response could not be validated as structured JSON. ResearchRanker discarded it instead of displaying potentially unreliable prose."
        )
      );
    }

    return Response.json(summary);
  } catch (error) {
    console.error("AI summarize route error:", error);

    if (isTimeoutError(error)) {
      return Response.json(
        { error: "AI summary timed out. Please try again." },
        { status: 504 }
      );
    }

    return Response.json(
      { error: "AI summary failed because of a server error." },
      { status: 500 }
    );
  }
}
