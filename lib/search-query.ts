const GEMINI_MODEL = "gemini-2.5-flash-lite";
const TRANSLATION_TIMEOUT_MS = 6_000;

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeArabicText(value: string) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/گ/g, "ك")
    .replace(/چ/g, "ج")
    .replace(/پ/g, "ب")
    .replace(/ژ/g, "ز")
    .replace(/\s+/g, " ")
    .trim();
}

export function containsArabic(value: string) {
  return /[\u0600-\u06FF]/.test(value);
}

export function extractDoi(value: string) {
  const decoded = (() => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  })();

  const normalized = cleanText(decoded)
    .replace(/^doi\s*:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .trim();

  const match = normalized.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);

  return match?.[0]?.replace(/[.,;]+$/g, "") || "";
}

const FIELD_HINTS: Record<string, string> = {
  all: "all academic fields",
  medicine: "medicine and health sciences",
  "life-sciences": "life sciences",
  biochemistry: "biochemistry",
  chemistry: "chemistry",
  physics: "physics",
  "computer-science": "computer science",
  engineering: "engineering",
  mathematics: "mathematics",
  "environmental-science": "environmental science",
  agriculture: "agriculture",
  education: "education",
  psychology: "psychology",
  "social-sciences": "social sciences",
  business: "business and management",
  economics: "economics",
  law: "law",
  "arts-humanities": "arts and humanities",
  linguistics: "linguistics",
  literature: "literature",
  history: "history",
  geography: "geography",
};

const ARABIC_FALLBACK_TERMS: Array<{ keys: string[]; english: string }> = [
  { keys: ["الذكاء الاصطناعي", "ذكاء اصطناعي"], english: "artificial intelligence" },
  { keys: ["تعلم الاله", "تعلم الآلة"], english: "machine learning" },
  { keys: ["التعلم العميق"], english: "deep learning" },
  { keys: ["غسيل الكلى", "الديلزه", "ديلزة"], english: "hemodialysis" },
  { keys: ["الفشل الكلوي", "قصور الكلى"], english: "renal failure" },
  { keys: ["مرض الكلى المزمن"], english: "chronic kidney disease" },
  { keys: ["الكلى"], english: "kidney" },
  { keys: ["السكري", "داء السكري", "مرض السكري"], english: "diabetes mellitus" },
  { keys: ["ما قبل السكري", "مقدمات السكري"], english: "prediabetes" },
  { keys: ["الالتهاب", "التهابات"], english: "inflammation" },
  { keys: ["الاجهاد التأكسدي", "الاجهاد التاكسدي"], english: "oxidative stress" },
  { keys: ["القلب", "امراض القلب"], english: "cardiovascular disease" },
  { keys: ["ضغط الدم", "ارتفاع الضغط"], english: "hypertension" },
  { keys: ["السرطان", "سرطان"], english: "cancer" },
  { keys: ["التوحد", "طيف التوحد"], english: "autism spectrum disorder" },
  { keys: ["الرصاص", "تسمم الرصاص"], english: "lead poisoning" },
  { keys: ["الكيمياء الحياتيه", "الكيمياء الحياتية", "الكيمياء الحيويه", "الكيمياء الحيوية"], english: "biochemistry" },
  { keys: ["التربيه", "التربية", "التعليم"], english: "education" },
  { keys: ["البيئه", "البيئة", "التلوث"], english: "environmental pollution" },
  { keys: ["المضادات الحيويه", "مقاومة المضادات"], english: "antimicrobial resistance" },
];

function buildDictionaryFallback(query: string) {
  const normalized = normalizeArabicText(query);
  const terms = new Set<string>();

  for (const item of ARABIC_FALLBACK_TERMS) {
    if (item.keys.some((key) => normalized.includes(normalizeArabicText(key)))) {
      terms.add(item.english);
    }
  }

  return Array.from(terms).join(" ");
}

async function translateArabicQueryWithGemini(query: string, field: string) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return "";
  }

  const fieldHint = FIELD_HINTS[field] || field || "all academic fields";
  const prompt = `Translate the Arabic scholarly search query below into a concise English academic search query for Crossref and OpenAlex.

Rules:
- Preserve the exact scientific meaning and relationships between concepts.
- Preserve acronyms, genes, biomarkers, chemicals, diseases, author names, numbers, and quoted phrases.
- Do not invent extra diseases, biomarkers, methods, or outcomes.
- Use standard terminology commonly found in article titles and abstracts.
- Keep the result concise; prefer the core concepts over long synonym lists.
- Use the field hint only to disambiguate terminology, not to broaden the topic.
- Return JSON only with this shape: {"query":"..."}.

Field hint: ${fieldHint}
Arabic query: ${query}`;

  try {
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
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 180,
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                query: { type: "string" },
              },
              required: ["query"],
            },
          },
        }),
        signal: AbortSignal.timeout(TRANSLATION_TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      return "";
    }

    const data = await response.json();
    const text = cleanText(data?.candidates?.[0]?.content?.parts?.[0]?.text || "");

    if (!text) {
      return "";
    }

    const parsed = JSON.parse(text) as { query?: string };
    return cleanText(parsed.query).slice(0, 500);
  } catch {
    return "";
  }
}

export type PreparedSearchQuery = {
  query: string;
  field: string;
  isDoi: boolean;
  translatedFromArabic: boolean;
};

export async function prepareSearchQuery(
  rawQuery: string,
  field: string
): Promise<PreparedSearchQuery> {
  const query = cleanText(rawQuery);
  const doi = extractDoi(query);

  if (doi) {
    return {
      query: doi,
      field: "all",
      isDoi: true,
      translatedFromArabic: false,
    };
  }

  if (!containsArabic(query)) {
    return {
      query,
      field,
      isDoi: false,
      translatedFromArabic: false,
    };
  }

  const translated = await translateArabicQueryWithGemini(query, field);
  const dictionaryFallback = buildDictionaryFallback(query);
  const prepared = translated || dictionaryFallback || query;

  return {
    query: prepared,
    field: prepared === query ? field : "all",
    isDoi: false,
    translatedFromArabic: prepared !== query,
  };
}
