type OpenAlexSource = {
  id?: string;
  display_name?: string;
  issn_l?: string;
  issn?: string[];
  host_organization_name?: string;
  is_oa?: boolean;
  is_in_doaj?: boolean;
  works_count?: number;
  cited_by_count?: number;
  homepage_url?: string;
  summary_stats?: {
    h_index?: number;
    i10_index?: number;
    two_year_mean_citedness?: number;
  };
};

type OpenAlexResponse = { results?: OpenAlexSource[] };

function cleanText(value: unknown, max = 500) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = cleanText(searchParams.get("q"), 300);
    if (!query) return Response.json({ error: "Topic is required." }, { status: 400 });

    const url = new URL("https://api.openalex.org/sources");
    url.searchParams.set("search", query);
    url.searchParams.set("per-page", "12");
    url.searchParams.set("mailto", process.env.OPENALEX_EMAIL || "researchranker@example.com");

    const response = await fetch(url, { next: { revalidate: 3600 } });
    const data = (await response.json()) as OpenAlexResponse;
    if (!response.ok) return Response.json({ error: "Journal discovery service failed." }, { status: 502 });

    const journals = (data.results || []).map((source) => ({
      id: source.id || "",
      title: source.display_name || "Unknown journal",
      issn: source.issn_l || source.issn?.[0] || "",
      publisher: source.host_organization_name || "",
      isOpenAccess: Boolean(source.is_oa),
      inDoaj: Boolean(source.is_in_doaj),
      hIndex: source.summary_stats?.h_index ?? null,
      twoYearMeanCitedness: source.summary_stats?.two_year_mean_citedness ?? null,
      worksCount: source.works_count ?? null,
      citedByCount: source.cited_by_count ?? null,
      homepageUrl: source.homepage_url || "",
      matchBasis: "OpenAlex source search",
      caveat:
        "Candidate journal based on indexed source discovery. Scope fit, APC, review time, and quartile must be verified from primary or licensed sources before submission.",
    }));

    return Response.json({ journals, query, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Journal finder error:", error);
    return Response.json({ error: "Failed to discover journals." }, { status: 500 });
  }
}
