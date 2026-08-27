function cleanText(value: unknown, max = 5000) {
  return String(value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function getYear(parts: unknown) {
  if (!Array.isArray(parts)) return "";
  const first = parts[0];
  return Array.isArray(first) && first[0] ? String(first[0]) : "";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const doi = cleanText(searchParams.get("doi"), 300).replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
    if (!doi) return Response.json({ error: "DOI is required." }, { status: 400 });

    const crossrefUrl = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
    const openAlexUrl = `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(doi)}`;

    const [crossrefResponse, openAlexResponse] = await Promise.all([
      fetch(crossrefUrl, { headers: { "User-Agent": "ResearchRanker/1.0" }, next: { revalidate: 21600 } }),
      fetch(openAlexUrl, { next: { revalidate: 21600 } }),
    ]);

    const crossrefData = crossrefResponse.ok ? await crossrefResponse.json() : null;
    const openAlexData = openAlexResponse.ok ? await openAlexResponse.json() : null;
    const work = crossrefData?.message || {};

    const authors = Array.isArray(work.author)
      ? work.author
          .slice(0, 20)
          .map((author: { given?: string; family?: string; name?: string }) => cleanText(author.name || `${author.given || ""} ${author.family || ""}`))
          .filter(Boolean)
          .join(", ")
      : "";

    const relations = work.relation && typeof work.relation === "object" ? work.relation : {};
    const relationEntries = Object.entries(relations).flatMap(([relation, value]) => {
      const values = Array.isArray(value) ? value : [];
      return values.slice(0, 20).map((item: unknown) => {
        const row = item as { id?: string; "id-type"?: string; "asserted-by"?: string };
        return {
          relation,
          id: cleanText(row.id, 500),
          idType: cleanText(row["id-type"], 80),
          assertedBy: cleanText(row["asserted-by"], 80),
        };
      });
    });

    const oa = openAlexData?.open_access || {};
    const primaryLocation = openAlexData?.primary_location || {};
    const source = primaryLocation?.source || {};

    const trustSignals = [
      ...(relationEntries.length
        ? [{
            level: "attention",
            label: "Crossref relationship metadata present",
            detail: "This record has update/correction/retraction-related relation metadata. Review the linked records before relying on the paper.",
            source: "Crossref",
          }]
        : []),
      {
        level: "info",
        label: crossrefResponse.ok ? "Crossref metadata verified" : "Crossref metadata unavailable",
        detail: crossrefResponse.ok ? "DOI metadata was resolved directly from Crossref." : "Crossref could not resolve this DOI during the current check.",
        source: "Crossref",
      },
      {
        level: "info",
        label: openAlexResponse.ok ? "OpenAlex record verified" : "OpenAlex record unavailable",
        detail: openAlexResponse.ok ? "Citation and open-access metadata were resolved from OpenAlex." : "OpenAlex could not resolve this DOI during the current check.",
        source: "OpenAlex",
      },
    ];

    return Response.json({
      article: {
        doi,
        title: cleanText(work.title?.[0] || openAlexData?.title, 1000),
        abstract: cleanText(work.abstract || "", 12000),
        authors,
        journal: cleanText(work["container-title"]?.[0] || source?.display_name, 500),
        publisher: cleanText(work.publisher || source?.host_organization_name, 500),
        year: getYear(work.published?.["date-parts"] || work.issued?.["date-parts"]) || String(openAlexData?.publication_year || ""),
        type: cleanText(work.type || openAlexData?.type, 120),
        issn: Array.isArray(work.ISSN) ? work.ISSN : source?.issn || [],
        citedByCount: openAlexData?.cited_by_count ?? null,
        isOpenAccess: Boolean(oa.is_oa),
        oaStatus: cleanText(oa.oa_status, 80),
        oaUrl: cleanText(oa.oa_url || primaryLocation?.pdf_url || primaryLocation?.landing_page_url, 1000),
        primaryUrl: cleanText(work.URL || primaryLocation?.landing_page_url, 1000),
        openAlexId: cleanText(openAlexData?.id, 300),
        referencedWorks: Array.isArray(openAlexData?.referenced_works) ? openAlexData.referenced_works.slice(0, 50) : [],
        relatedWorks: Array.isArray(openAlexData?.related_works) ? openAlexData.related_works.slice(0, 30) : [],
      },
      relations: relationEntries,
      trustSignals,
      checkedAt: new Date().toISOString(),
      provenance: {
        bibliographic: "Crossref",
        citationsAndOA: "OpenAlex",
      },
    });
  } catch (error) {
    console.error("Article detail error:", error);
    return Response.json({ error: "Failed to load article details." }, { status: 500 });
  }
}
