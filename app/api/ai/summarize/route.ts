type GeminiSummaryResponse = {
  objective?: string;
  methodology?: string;
  keyFindings?: string[];
  conclusion?: string;
  researchValue?: string;
  limitationNote?: string;
};

const GEMINI_MODEL = "gemini-2.5-flash-lite";
const MAX_ABSTRACT_CHARS = 3000;

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function limitText(value: string, maxChars = MAX_ABSTRACT_CHARS) {
  const cleanValue = cleanText(value);

  if (cleanValue.length <= maxChars) {
    return cleanValue;
  }

  return `${cleanValue.slice(0, maxChars)}...`;
}

function safeParseJson(text: string): GeminiSummaryResponse {
  try {
    const cleaned = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    return JSON.parse(cleaned) as GeminiSummaryResponse;
  } catch {
    return {
      objective: "AI summary generated as plain text.",
      methodology: "",
      keyFindings: [text],
      conclusion: "",
      researchValue: "",
      limitationNote:
        "The AI response was not returned as structured JSON. Review manually before academic use.",
    };
  }
}

export async function POST(request: Request) {
  try {
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

    const title = cleanText(body?.title);
    const journal = cleanText(body?.journal);
    const abstract = limitText(body?.abstract || "");
    const authors = cleanText(body?.authors);
    const pubdate = cleanText(body?.pubdate);

    if (!title && !abstract) {
      return Response.json(
        {
          error: "Missing article title or abstract.",
        },
        { status: 400 }
      );
    }

    const prompt = `
You are an academic research assistant.

Summarize the following research article in concise academic English.
Use only the information provided. Do not invent results.
Return valid JSON only. Do not use markdown.

JSON format:
{
  "objective": "one concise sentence",
  "methodology": "one concise sentence",
  "keyFindings": ["point 1", "point 2", "point 3"],
  "conclusion": "one concise sentence",
  "researchValue": "one concise sentence",
  "limitationNote": "one concise sentence"
}

Article data:
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
            temperature: 0.2,
            maxOutputTokens: 700,
            responseMimeType: "application/json",
          },
        }),
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

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "";

    if (!text) {
      return Response.json(
        {
          error: "Gemini returned an empty response.",
        },
        { status: 500 }
      );
    }

    const summary = safeParseJson(text);

    return Response.json({
      summary,
    });
  } catch (error) {
    console.error("AI summarize route error:", error);

    return Response.json(
      {
        error: "AI summary failed because of a server error.",
      },
      { status: 500 }
    );
  }
}