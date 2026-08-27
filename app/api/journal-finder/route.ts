import { cleanText } from "@/lib/research-types";

type SearchArticle = {
  title?: string;
  journal?: string;
  quartile?: string;
  publisher?: string;
  issn?: string;
  sjr?: string;
  hIndex?: string;
  matchConfidence?: string;
  indexingStatus?: string;
};

function isVerified(article: SearchArticle) {
  const confidence = cleanText(article.matchConfidence).toLowerCase();
  return (
    /^Q[1-4]$/.test(cleanText(article.quartile)) &&
    (confidence.includes("issn exact match") ||
      confidence.includes("journal title exact match") ||
      confidence.includes("strict token match"))
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const manuscript = cleanText(body?.manuscript || body?.query).slice(0, 4000);
    const quartile = cleanText(body?.quartile || "All");
    if (!manuscript) return Response.json({ error: "Manuscript title, abstract, or keywords are required." }, { status: 400 });

    const searchText = manuscript.slice(0, 700);
    const origin = new URL(request.url).origin;
    const params = new URLSearchParams({
      query: searchText,
      fromYear: String(new Date().getFullYear() - 8),
      toYear: String(new Date().getFullYear()),
      maxResults: "50",
      field: "all",
    });

    const response = await fetch(`${origin}/api/global-search?${params.toString()}`, {
      cache: "no-store",
      headers: { "x-researchranker-internal": "journal-finder" },
    });
    const data = await response.json();
    if (!response.ok || !Array.isArray(data)) {
      return Response.json({ error: "Unable to retrieve evidence for journal matching." }, { status: 502 });
    }

    const journalMap = new Map<string, {
      name: string;
      articles: number;
      verifiedArticles: number;
      quartile: string;
      publisher: string;
      issn: string;
      sjr: string;
      hIndex: string;
      indexingStatus: string;
      matchConfidence: string;
    }>();

    for (const article of data as SearchArticle[]) {
      const name = cleanText(article.journal);
      if (!name) continue;
      const key = name.toLowerCase();
      const current = journalMap.get(key) || {
        name,
        articles: 0,
        verifiedArticles: 0,
        quartile: "Unverified",
        publisher: "",
        issn: "",
        sjr: "",
        hIndex: "",
        indexingStatus: "Unknown",
        matchConfidence: "Not matched",
      };

      current.articles += 1;
      if (isVerified(article)) {
        current.verifiedArticles += 1;
        current.quartile = cleanText(article.quartile);
        current.publisher = cleanText(article.publisher) || current.publisher;
        current.issn = cleanText(article.issn) || current.issn;
        current.sjr = cleanText(article.sjr) || current.sjr;
        current.hIndex = cleanText(article.hIndex) || current.hIndex;
        current.indexingStatus = cleanText(article.indexingStatus) || current.indexingStatus;
        current.matchConfidence = cleanText(article.matchConfidence) || current.matchConfidence;
      }
      journalMap.set(key, current);
    }

    const candidates = Array.from(journalMap.values())
      .map((journal) => {
        const quartileMatch = quartile === "All" || journal.quartile === quartile;
        const score = Math.min(
          100,
          Math.round(
            journal.articles * 7 + journal.verifiedArticles * 12 + (quartileMatch ? 18 : 0)
          )
        );
        return {
          ...journal,
          score,
          evidence: `${journal.articles} relevant papers found; ${journal.verifiedArticles} had a verified journal match.`,
          openAccess: null,
          apc: null,
          reviewTime: null,
          caveat:
            "APC, review time, and open-access policy are intentionally left unreported unless a verifiable publisher or registry source is available.",
        };
      })
      .filter((journal) => quartile === "All" || journal.quartile === quartile || journal.quartile === "Unverified")
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    return Response.json({ candidates, evidenceSource: "ResearchRanker scholarly search + verified journal matching" });
  } catch (error) {
    console.error("Journal finder error:", error);
    return Response.json({ error: "Journal Finder failed." }, { status: 500 });
  }
}
