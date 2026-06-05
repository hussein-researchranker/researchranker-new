type SummaryRequest = {
  title?: string;
  journal?: string;
  pubdate?: string;
  authors?: string;
  doi?: string;
  abstract?: string;
};

type GeminiCandidate = {
  content?: {
    parts?: Array<{ text?: string }>;
  };
};

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("Gemini response was not valid JSON.");
    }

    return JSON.parse(match[0]);
  }
}

function normalizeSummary(value: unknown) {
  const record = value as Record<string, unknown>;

  return {
    objective: cleanText(record.objective) || "Not specified",
    methodology: cleanText(record.methodology) || "Not specified",
    keyFindings: Array.isArray(record.keyFindings)
      ? record.keyFindings.map((item) => cleanText(item)).filter(Boolean).slice(0, 5)
      : [cleanText(record.keyFindings) || "Not specified"],
    conclusion: cleanText(record.conclusion) || "Not specified",
    researchValue: cleanText(record.researchValue) || "Not specified",
    limitation: cleanText(record.limitation) || "AI summary is based on the metadata and abstract available in PubMed.",
  };
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "Missing GEMINI_API_KEY environment variable." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as SummaryRequest;
    const title = cleanText(body.title);
    const abstract = cleanText(body.abstract);
    const journal = cleanText(body.journal);
    const pubdate = cleanText(body.pubdate);
    const authors = cleanText(body.authors);
    const doi = cleanText(body.doi);

    if (!title && !abstract) {
      return Response.json(
        { error: "Missing article title or abstract." },
        { status: 400 }
      );
    }

    const sourceText = [
      `Title: ${title || "Not available"}`,
      `Journal: ${journal || "Not available"}`,
      `Publication date: ${pubdate || "Not available"}`,
      `Authors: ${authors || "Not available"}`,
      `DOI: ${doi || "Not available"}`,
      `Abstract: ${abstract || "No abstract available. Summarize cautiously using the available metadata only."}`,
    ].join("\n");

    const prompt = `You are an academic biomedical research assistant. Summarize the article below accurately and cautiously. Do not invent numerical results, methods, sample sizes, or conclusions that are not supported by the text. Return JSON only with these exact keys: objective, methodology, keyFindings, conclusion, researchValue, limitation. keyFindings must be an array of 3 to 5 short bullet-like strings.\n\nArticle data:\n${sourceText}`;

    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const geminiResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", errorText);
      return Response.json(
        { error: "Gemini API request failed." },
        { status: 502 }
      );
    }

    const geminiData = await geminiResponse.json();
    const candidate = geminiData?.candidates?.[0] as GeminiCandidate | undefined;
    const text = candidate?.content?.parts?.map((part) => part.text || "").join("\n") || "";

    if (!text) {
      return Response.json(
        { error: "Gemini returned an empty response." },
        { status: 502 }
      );
    }

    const parsed = safeJsonParse(text);

    return Response.json(normalizeSummary(parsed));
  } catch (error) {
    console.error("AI summarize API error:", error);
    return Response.json({ error: "AI summarization failed." }, { status: 500 });
  }
}
