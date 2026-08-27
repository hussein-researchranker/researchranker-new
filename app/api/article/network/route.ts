import { cleanText } from "@/lib/research-types";

type GraphNode = {
  id: string;
  title: string;
  year?: number;
  doi?: string;
  citedByCount?: number;
  type: "center" | "reference" | "citing" | "related";
};

type GraphEdge = { source: string; target: string; kind: "references" | "cited-by" | "related" };

function nodeFromWork(work: any, type: GraphNode["type"]): GraphNode | null {
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

async function fetchWorks(ids: string[], type: GraphNode["type"]) {
  const unique = Array.from(new Set(ids.map((id) => cleanText(id).replace("https://openalex.org/", "")).filter(Boolean))).slice(0, 8);
  if (!unique.length) return [] as GraphNode[];
  const filter = unique.join("|");
  const response = await fetch(`https://api.openalex.org/works?filter=openalex_id:${encodeURIComponent(filter)}&per-page=8`, {
    headers: { "User-Agent": "ResearchRanker/1.0" },
    next: { revalidate: 21600 },
  });
  if (!response.ok) return [];
  const data = await response.json();
  return (Array.isArray(data?.results) ? data.results : [])
    .map((work: any) => nodeFromWork(work, type))
    .filter((node: GraphNode | null): node is GraphNode => Boolean(node));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const doi = cleanText(searchParams.get("doi")).replace(/^https?:\/\/doi\.org\//i, "");
  if (!doi) return Response.json({ error: "DOI is required." }, { status: 400 });

  try {
    const centerResponse = await fetch(
      `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(doi)}`,
      { headers: { "User-Agent": "ResearchRanker/1.0" }, next: { revalidate: 21600 } }
    );
    if (!centerResponse.ok) {
      return Response.json({ error: "OpenAlex work not found." }, { status: 404 });
    }

    const work = await centerResponse.json();
    const center = nodeFromWork(work, "center");
    if (!center) return Response.json({ error: "Invalid OpenAlex work." }, { status: 502 });

    const referenceIds = Array.isArray(work?.referenced_works) ? work.referenced_works.slice(0, 8) : [];
    const relatedIds = Array.isArray(work?.related_works) ? work.related_works.slice(0, 8) : [];

    const citedResponse = await fetch(
      `https://api.openalex.org/works?filter=cites:${encodeURIComponent(center.id)}&sort=cited_by_count:desc&per-page=8`,
      { headers: { "User-Agent": "ResearchRanker/1.0" }, next: { revalidate: 21600 } }
    );
    const citedData = citedResponse.ok ? await citedResponse.json() : { results: [] };
    const citing = (Array.isArray(citedData?.results) ? citedData.results : [])
      .map((entry: any) => nodeFromWork(entry, "citing"))
      .filter((node: GraphNode | null): node is GraphNode => Boolean(node));

    const [references, related] = await Promise.all([
      fetchWorks(referenceIds, "reference"),
      fetchWorks(relatedIds, "related"),
    ]);

    const nodes = [center, ...references, ...citing, ...related];
    const edges: GraphEdge[] = [
      ...references.map((node) => ({ source: center.id, target: node.id, kind: "references" as const })),
      ...citing.map((node) => ({ source: node.id, target: center.id, kind: "cited-by" as const })),
      ...related.map((node) => ({ source: center.id, target: node.id, kind: "related" as const })),
    ];

    return Response.json({ center, nodes, edges, source: "OpenAlex", checkedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Article network error:", error);
    return Response.json({ error: "Failed to build paper network." }, { status: 500 });
  }
}
