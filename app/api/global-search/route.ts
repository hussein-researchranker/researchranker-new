type GlobalArticle = {
  id: string;
  pmid?: string;
  title: string;
  journal: string;
  pubdate: string;
  authors: string;
  doi: string;
  abstract: string;
  source: string;
  sourceUrl: string;
  pubmedUrl?: string;
  quartile: string;
  indexingStatus: string;
  sjr: string;
  hIndex: string;
  publisher: string;
  issn: string;
  matchConfidence: string;
};

type CrossrefAuthor = {
  given?: string;
  family?: string;
  name?: string;
};

type CrossrefWork = {
  DOI?: string;
  title?: string[];
  subtitle?: string[];
  abstract?: string;
  author?: CrossrefAuthor[];
  "container-title"?: string[];
  publisher?: string;
  ISSN?: string[];
  issued?: {
    "date-parts"?: number[][];
  };
  published?: {
    "date-parts"?: number[][];
  };
  URL?: string;
  type?: string;
  subject?: string[];
};

type CrossrefResponse = {
  message?: {
    items?: CrossrefWork[];
  };
};

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getPublicationDate(work: CrossrefWork) {
  const dateParts =
    work.published?.["date-parts"]?.[0] ||
    work.issued?.["date-parts"]?.[0] ||
    [];

  if (!dateParts.length) return "";

  const [year, month, day] = dateParts;

  return [year, month, day].filter(Boolean).join("-");
}

function getAuthors(authors?: CrossrefAuthor[]) {
  if (!authors || authors.length === 0) {
    return "";
  }

  return authors
    .slice(0, 8)
    .map((author) => {
      if (author.name) return cleanText(author.name);

      const given = cleanText(author.given);
      const family = cleanText(author.family);

      return [given, family].filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join(", ");
}

function getYearFromDate(value: string) {
  const match = value.match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

function buildFieldQuery(query: string, field: string) {
  const cleanQuery = cleanText(query);

  if (!cleanQuery || field === "all") {
    return cleanQuery;
  }

  const fieldFilters: Record<string, string> = {
    medicine:
      "medicine clinical patient disease diagnosis therapy hospital healthcare",
    "life-sciences":
      "biology biological cell molecular genetics physiology",
    biochemistry:
      "biochemistry biochemical enzyme protein metabolism biomarker",
    chemistry:
      "chemistry chemical synthesis compound molecule analytical",
    physics:
      "physics physical quantum optics mechanics thermodynamics",
    "computer-science":
      "computer science artificial intelligence machine learning deep learning software algorithm data mining neural network",
    engineering:
      "engineering mechanical electrical civil materials design optimization",
    mathematics:
      "mathematics mathematical statistics probability algebra geometry modeling",
    "environmental-science":
      "environment environmental pollution climate ecosystem sustainability",
    agriculture:
      "agriculture crop soil plant irrigation livestock",
    education:
      "education teaching learning curriculum students classroom pedagogy",
    psychology:
      "psychology psychological behavior cognition mental emotion",
    "social-sciences":
      "social science sociology society community culture",
    business:
      "business management marketing organization leadership",
    economics:
      "economics economic finance market trade development",
    law:
      "law legal legislation regulation policy",
    "arts-humanities":
      "humanities philosophy arts culture ethics",
    linguistics:
      "linguistics language discourse phonology syntax semantics",
    literature:
      "literature literary novel poetry narrative text analysis",
    history:
      "history historical archive civilization heritage",
    geography:
      "geography geographic spatial GIS urban regional",
  };

  const filter = fieldFilters[field];

  if (!filter) {
    return cleanQuery;
  }

  return `${cleanQuery} ${filter}`;
}

function normalizeCrossrefWork(work: CrossrefWork): GlobalArticle | null {
  const doi = cleanText(work.DOI);
  const title = cleanText(
    [work.title?.[0], work.subtitle?.[0]].filter(Boolean).join(": ")
  );

  if (!title && !doi) {
    return null;
  }

  const journal = cleanText(work["container-title"]?.[0]);
  const pubdate = getPublicationDate(work);
  const sourceUrl = doi ? `https://doi.org/${doi}` : cleanText(work.URL);

  return {
    id: doi || encodeURIComponent(title.toLowerCase()),
    title,
    journal,
    pubdate,
    authors: getAuthors(work.author),
    doi,
    abstract: cleanText(work.abstract),
    source: "Crossref",
    sourceUrl,
    quartile: "Not found",
    indexingStatus: journal
      ? "Crossref metadata / journal quartile requires SCImago matching"
      : "Crossref metadata / source not clearly identified",
    sjr: "",
    hIndex: "",
    publisher: cleanText(work.publisher),
    issn: Array.isArray(work.ISSN) ? work.ISSN.join(", ") : "",
    matchConfidence: "Crossref metadata",
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const query = cleanText(
      searchParams.get("query") || searchParams.get("q") || ""
    );
    const field = cleanText(searchParams.get("field") || "all");
    const fromYear = Number(searchParams.get("fromYear") || "1990");
    const toYear = Number(
      searchParams.get("toYear") || new Date().getFullYear()
    );
    const maxResults = Math.min(
      Math.max(Number(searchParams.get("maxResults") || "50"), 1),
      100
    );

    if (!query) {
      return Response.json(
        { error: "Missing query parameter." },
        { status: 400 }
      );
    }

    const fieldAwareQuery = buildFieldQuery(query, field);

    const params = new URLSearchParams({
      "query.bibliographic": fieldAwareQuery,
      rows: String(maxResults),
      select:
        "DOI,title,subtitle,author,container-title,publisher,ISSN,issued,published,URL,type,subject,abstract",
      sort: "relevance",
      order: "desc",
      filter: `from-pub-date:${fromYear},until-pub-date:${toYear}`,
    });

    const response = await fetch(`https://api.crossref.org/works?${params}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "ResearchRanker/1.0 (mailto:husseinjk40@gmail.com)",
      },
      next: {
        revalidate: 60 * 30,
      },
    });

    const data = (await response.json()) as CrossrefResponse;

    if (!response.ok) {
      return Response.json(
        { error: "Crossref search failed." },
        { status: response.status }
      );
    }

    const articles = (data.message?.items || [])
      .map(normalizeCrossrefWork)
      .filter((article): article is GlobalArticle => Boolean(article))
      .filter((article) => {
        const year = getYearFromDate(article.pubdate);

        if (!year) return true;

        return year >= fromYear && year <= toYear;
      });

    return Response.json(articles);
  } catch (error) {
    console.error("Global search route error:", error);

    return Response.json(
      { error: "Global search failed because of a server error." },
      { status: 500 }
    );
  }
}