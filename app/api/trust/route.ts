import { cleanText } from "@/lib/research-types";

type TrustResponse = {
  doi: string;
  retracted: boolean | null;
  retractionSource?: string;
  correctionRelations: string[];
  crossrefType?: string;
  publisher?: string;
  indexedInOpenAlex: boolean;
  checkedAt: string;
  warnings: string[];
  evidence: Array<{ label: string; source: string; url: string }>;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const doi = cleanText(searchParams.get("doi"))
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .toLowerCase();

  if (!doi) {
    return Response.json({ error: "DOI is required." }, { status: 400 });
  }

  const result: TrustResponse = {
    doi,
    retracted: null,
    correctionRelations: [],
    indexedInOpenAlex: false,
    checkedAt: new Date().toISOString(),
    warnings: [],
    evidence: [],
  };

  try {
    const openAlexUrl = `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(doi)}`;
    const openAlexResponse = await fetch(openAlexUrl, {
      headers: { "User-Agent": "ResearchRanker/1.0" },
      next: { revalidate: 21600 },
    });

    if (openAlexResponse.ok) {
      const work = await openAlexResponse.json();
      result.indexedInOpenAlex = true;
      result.retracted = typeof work?.is_retracted === "boolean" ? work.is_retracted : null;
      if (result.retracted) {
        result.retractionSource = "OpenAlex";
        result.warnings.push("OpenAlex marks this work as retracted. Verify the publisher notice before use.");
      }
      result.evidence.push({ label: "OpenAlex work record", source: "OpenAlex", url: openAlexUrl });
    }
  } catch (error) {
    console.error("OpenAlex trust check failed:", error);
  }

  try {
    const crossrefUrl = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
    const crossrefResponse = await fetch(crossrefUrl, {
      headers: { "User-Agent": "ResearchRanker/1.0 (mailto:researchranker@example.com)" },
      next: { revalidate: 21600 },
    });

    if (crossrefResponse.ok) {
      const data = await crossrefResponse.json();
      const message = data?.message || {};
      result.crossrefType = cleanText(message.type);
      result.publisher = cleanText(message.publisher);

      const relation = message.relation && typeof message.relation === "object" ? message.relation : {};
      result.correctionRelations = Object.entries(relation)
        .flatMap(([kind, entries]) =>
          Array.isArray(entries)
            ? entries.map((entry: { id?: string }) => `${kind}: ${cleanText(entry?.id)}`).filter(Boolean)
            : []
        )
        .slice(0, 20);

      if (result.correctionRelations.some((entry) => /retract/i.test(entry))) {
        result.warnings.push("Crossref relation metadata contains a retraction-related relation.");
        if (result.retracted === null) result.retracted = true;
      }

      result.evidence.push({ label: "Crossref DOI metadata", source: "Crossref", url: crossrefUrl });
    }
  } catch (error) {
    console.error("Crossref trust check failed:", error);
  }

  if (result.retracted === null) {
    result.warnings.push(
      "No definitive automated retraction signal was available. Absence of a warning is not proof that the article is valid."
    );
  }

  result.warnings.push(
    "ResearchRanker does not label a journal as predatory without a verifiable source; use publisher, indexing, and policy evidence instead."
  );

  return Response.json(result);
}
