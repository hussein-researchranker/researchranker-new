function cleanText(value: unknown, max = 500) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function shortId(value: unknown) {
  const text = cleanText(value, 300);
  const match = text.match(/W\d+$/);
  return match?.[0] || text;
}

async function fetchWork(id: string) {
  try {
    const response = await fetch(`https://api.openalex.org/works/${encodeURIComponent(id)}`, { next: { revalidate: 21600 } });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function nodeFromWork(work: Record<string, unknown>, relation: string) {
  const primary = (work.primary_location || {}) as Record<string, unknown>;
  const source = (primary.source || {}) as Record<string, unknown>;
  return {
    id: shortId(work.id),
    title: cleanText(work.title, 500),
    year: Number(work.publication_year) || null,
    citedByCount: Number(work.cited_by_count) || 0,
    doi: cleanText(work.doi, 300).replace(/^https:\/\/doi\.org\//i, ""),
    journal: cleanText(source.display_name, 300),
    relation,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const doi = cleanText(searchParams.get("doi"), 300).replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
    if (!doi) return Response.json({ error: "DOI is required." }, { status: 400 });

    const baseResponse = await fetch(`https://api.openalex.org/works/https://doi.org/${encodeURIComponent(doi)}`, { next: { revalidate: 21600 } });
    if (!baseResponse.ok) return Response.json({ error: "Paper not found in OpenAlex." }, { status: 404 });
    const base = await baseResponse.json();
    const baseId = shortId(base.id);

    const relatedIds = Array.isArray(base.related_works) ? base.related_works.slice(0, 6).map(shortId) : [];
    const referenceIds = Array.isArray(base.referenced_works) ? base.referenced_works.slice(0, 6).map(shortId) : [];

    const citedByUrl = new URL("https://api.openalex.org/works");
    citedByUrl.searchParams.set("filter", `cites:${baseId}`);
    citedByUrl.searchParams.set("sort", "cited_by_count:desc");
    citedByUrl.searchParams.set("per-page", "6");

    const [relatedWorks, referenceWorks, citedByResponse] = await Promise.all([
      Promise.all(relatedIds.map(fetchWork)),
      Promise.all(referenceIds.map(fetchWork)),
      fetch(citedByUrl, { next: { revalidate: 21600 } }),
    ]);

    const citedByData = citedByResponse.ok ? await citedByResponse.json() : { results: [] };
    const center = nodeFromWork(base, "center");
    const related = relatedWorks.filter(Boolean).map((work) => nodeFromWork(work, "related"));
    const references = referenceWorks.filter(Boolean).map((work) => nodeFromWork(work, "reference"));
    const citedBy = Array.isArray(citedByData.results)
      ? citedByData.results.slice(0, 6).map((work: Record<string, unknown>) => nodeFromWork(work, "cited-by"))
      : [];

    const unique = new Map<string, ReturnType<typeof nodeFromWork>>();
    [center, ...related, ...references, ...citedBy].forEach((node) => {
      if (node.id) unique.set(node.id, node);
    });
    const nodes = Array.from(unique.values());
    const edges = nodes
      .filter((node) => node.id !== center.id)
      .map((node) => ({
        source: center.id,
        target: node.id,
        relation: node.relation,
      }));

    return Response.json({ nodes, edges, generatedAt: new Date().toISOString(), source: "OpenAlex" });
  } catch (error) {
    console.error("Graph API error:", error);
    return Response.json({ error: "Failed to build paper graph." }, { status: 500 });
  }
}
