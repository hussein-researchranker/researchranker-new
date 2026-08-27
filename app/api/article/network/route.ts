import { cleanText } from "@/lib/research-types";

type GraphNode = {
  id: string;
  title: string;
  year?: number;
  doi?: string;
  citedByCount?: number;
  type: "center" | "reference" | "citing" | "related";
};

type GraphEdge = {
  source: string;
  target: string;
  kind: "references" | "cited-by" | "related";
};

function nodeFromOpenAlex(work: any, type: GraphNode["type"]): GraphNode | null {
  const id = cleanText(work?.id).replace("https://openalex.org/", "");
  const title = cleanText(work?.display_name || work?.title);
  if (!id || !title) return null;
  return {
    id,
    title,
    year: Number(work?.publication_year) || undefined,
    doi: cleanText(work?.doi).replace(/^https?:\/\/doi\.org\//i, ""),
    citedByCount: Number(work?.cited_by_count) || 0,
    type,
  };
}

function openAlexUrl(path: string, params?: Record<string, string>) {
  const url = new URL(`https://api.openalex.org/${path}`);
  Object.entries(params || {}).forEach(([key, value]) => url.searchParams.set(key, value));
  const apiKey = cleanText(process.env.OPENALEX_API_KEY);
  if (apiKey) url.searchParams.set("api_key", apiKey);
  return url.toString();
}

async function fetchOpenAlexWorks(ids: string[], type: GraphNode["type"]) {
  const unique = Array.from(
    new Set(
      ids
        .map((id) => cleanText(id).replace("https://openalex.org/", ""))
        .filter(Boolean)
    )
  ).slice(0, 8);
  if (!unique.length) return [] as GraphNode[];

  const response = await fetch(
    openAlexUrl("works", {
      filter: `openalex:${unique.join("|")}`,
      per_page: "8",
      select: "id,display_name,publication_year,doi,cited_by_count",
    }),
    { headers: { "User-Agent": "ResearchRanker/1.0" }, next: { revalidate: 21600 } }
  );
  if (!response.ok) return [];
  const data = await response.json();
  return (Array.isArray(data?.results) ? data.results : [])
    .map((work: any) => nodeFromOpenAlex(work, type))
    .filter((node: GraphNode | null): node is GraphNode => Boolean(node));
}

function extractDoiFromPid(value: unknown) {
  const text = cleanText(value);
  const match = text.match(/(?:^|\s)doi:(10\.\d{4,9}\/\S+)/i);
  return match?.[1]?.replace(/[;,]+$/, "").toLowerCase() || "";
}

async function crossrefNode(doi: string, type: GraphNode["type"]): Promise<GraphNode> {
  try {
    const response = await fetch(
      `https://api.crossref.org/works/${encodeURIComponent(doi)}?select=DOI,title,published,issued,is-referenced-by-count`,
      { headers: { "User-Agent": "ResearchRanker/1.0" }, next: { revalidate: 21600 } }
    );
    if (response.ok) {
      const data = await response.json();
      const work = data?.message || {};
      const parts = work?.published?.["date-parts"]?.[0] || work?.issued?.["date-parts"]?.[0] || [];
      return {
        id: `doi:${doi}`,
        title: cleanText(work?.title?.[0]) || doi,
        year: Number(parts?.[0]) || undefined,
        doi: cleanText(work?.DOI || doi),
        citedByCount: Number(work?.["is-referenced-by-count"]) || 0,
        type,
      };
    }
  } catch (error) {
    console.error("Crossref graph metadata failed:", doi, error);
  }

  return { id: `doi:${doi}`, title: doi, doi, type };
}

async function buildOpenCitationsNetwork(doi: string) {
  const token = cleanText(process.env.OPENCITATIONS_ACCESS_TOKEN);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = token;

  const [referenceResponse, citationResponse, center] = await Promise.all([
    fetch(`https://api.opencitations.net/index/v2/references/doi:${encodeURIComponent(doi)}`, {
      headers,
      next: { revalidate: 21600 },
    }),
    fetch(`https://api.opencitations.net/index/v2/citations/doi:${encodeURIComponent(doi)}`, {
      headers,
      next: { revalidate: 21600 },
    }),
    crossrefNode(doi, "center"),
  ]);

  const referencesRaw = referenceResponse.ok ? await referenceResponse.json() : [];
  const citationsRaw = citationResponse.ok ? await citationResponse.json() : [];

  const referenceDois = Array.from(
    new Set(
      (Array.isArray(referencesRaw) ? referencesRaw : [])
        .map((item: any) => extractDoiFromPid(item?.cited))
        .filter(Boolean)
    )
  ).slice(0, 8) as string[];
  const citingDois = Array.from(
    new Set(
      (Array.isArray(citationsRaw) ? citationsRaw : [])
        .map((item: any) => extractDoiFromPid(item?.citing))
        .filter(Boolean)
    )
  ).slice(0, 8) as string[];

  const [references, citing] = await Promise.all([
    Promise.all(referenceDois.map((relatedDoi) => crossrefNode(relatedDoi, "reference"))),
    Promise.all(citingDois.map((relatedDoi) => crossrefNode(relatedDoi, "citing"))),
  ]);

  const nodes = [center, ...references, ...citing];
  const edges: GraphEdge[] = [
    ...references.map((node) => ({
      source: center.id,
      target: node.id,
      kind: "references" as const,
    })),
    ...citing.map((node) => ({
      source: node.id,
      target: center.id,
      kind: "cited-by" as const,
    })),
  ];

  return {
    center,
    nodes,
    edges,
    source: "OpenCitations Index + Crossref metadata",
    checkedAt: new Date().toISOString(),
  };
}

async function buildOpenAlexNetwork(doi: string) {
  const centerResponse = await fetch(openAlexUrl(`works/doi:${encodeURIComponent(doi)}`), {
    headers: { "User-Agent": "ResearchRanker/1.0" },
    next: { revalidate: 21600 },
  });
  if (!centerResponse.ok) return null;

  const work = await centerResponse.json();
  const center = nodeFromOpenAlex(work, "center");
  if (!center) return null;

  const referenceIds = Array.isArray(work?.referenced_works) ? work.referenced_works.slice(0, 8) : [];
  const relatedIds = Array.isArray(work?.related_works) ? work.related_works.slice(0, 8) : [];
  const citedResponse = await fetch(
    openAlexUrl("works", {
      filter: `cites:${center.id}`,
      sort: "-cited_by_count",
      per_page: "8",
      select: "id,display_name,publication_year,doi,cited_by_count",
    }),
    { headers: { "User-Agent": "ResearchRanker/1.0" }, next: { revalidate: 21600 } }
  );
  const citedData = citedResponse.ok ? await citedResponse.json() : { results: [] };
  const citing = (Array.isArray(citedData?.results) ? citedData.results : [])
    .map((entry: any) => nodeFromOpenAlex(entry, "citing"))
    .filter((node: GraphNode | null): node is GraphNode => Boolean(node));
  const [references, related] = await Promise.all([
    fetchOpenAlexWorks(referenceIds, "reference"),
    fetchOpenAlexWorks(relatedIds, "related"),
  ]);

  const nodes = [center, ...references, ...citing, ...related];
  const edges: GraphEdge[] = [
    ...references.map((node) => ({ source: center.id, target: node.id, kind: "references" as const })),
    ...citing.map((node) => ({ source: node.id, target: center.id, kind: "cited-by" as const })),
    ...related.map((node) => ({ source: center.id, target: node.id, kind: "related" as const })),
  ];
  return { center, nodes, edges, source: "OpenAlex", checkedAt: new Date().toISOString() };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const doi = cleanText(searchParams.get("doi"))
    .replace(/^https?:\/\/doi\.org\//i, "")
    .toLowerCase();
  if (!doi) return Response.json({ error: "DOI is required." }, { status: 400 });

  try {
    if (cleanText(process.env.OPENALEX_API_KEY)) {
      const openAlex = await buildOpenAlexNetwork(doi);
      if (openAlex) return Response.json(openAlex);
    }

    const fallback = await buildOpenCitationsNetwork(doi);
    if (fallback.nodes.length > 1) return Response.json(fallback);

    const openAlexWithoutKey = await buildOpenAlexNetwork(doi);
    if (openAlexWithoutKey) return Response.json(openAlexWithoutKey);

    return Response.json(
      { error: "No citation network was available for this DOI from the configured scholarly sources." },
      { status: 404 }
    );
  } catch (error) {
    console.error("Article network error:", error);
    return Response.json({ error: "Failed to build paper network." }, { status: 500 });
  }
}
