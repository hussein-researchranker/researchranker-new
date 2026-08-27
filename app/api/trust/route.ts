import { cleanText } from "@/lib/research-types";

type TrustResponse = {
  doi: string;
  retracted: boolean | null;
  retractionSource?: string;
  correctionRelations: string[];
  updateNotices: Array<{
    type: string;
    label: string;
    doi: string;
    source: string;
    updated?: string;
  }>;
  crossrefType?: string;
  publisher?: string;
  indexedInOpenAlex: boolean;
  checkedAt: string;
  warnings: string[];
  evidence: Array<{ label: string; source: string; url: string }>;
};

function openAlexUrl(path: string) {
  const url = new URL(`https://api.openalex.org/${path}`);
  const apiKey = cleanText(process.env.OPENALEX_API_KEY);
  if (apiKey) url.searchParams.set("api_key", apiKey);
  return url.toString();
}

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
    updateNotices: [],
    indexedInOpenAlex: false,
    checkedAt: new Date().toISOString(),
    warnings: [],
    evidence: [],
  };

  try {
    const url = openAlexUrl(`works/doi:${encodeURIComponent(doi)}`);
    const openAlexResponse = await fetch(url, {
      headers: { "User-Agent": "ResearchRanker/1.0" },
      next: { revalidate: 21600 },
    });

    if (openAlexResponse.ok) {
      const work = await openAlexResponse.json();
      result.indexedInOpenAlex = true;
      result.retracted = typeof work?.is_retracted === "boolean" ? work.is_retracted : null;
      if (result.retracted) {
        result.retractionSource = "OpenAlex";
        result.warnings.push(
          "OpenAlex marks this work as retracted. Verify the publisher or Crossref update notice before use."
        );
      }
      result.evidence.push({
        label: "OpenAlex work record",
        source: "OpenAlex",
        url: `https://openalex.org/${cleanText(work?.id).replace("https://openalex.org/", "")}`,
      });
    } else if (openAlexResponse.status === 401 || openAlexResponse.status === 403) {
      result.warnings.push(
        "OpenAlex verification was unavailable because this deployment does not currently have an OpenAlex API key. Crossref checks were still attempted."
      );
    }
  } catch (error) {
    console.error("OpenAlex trust check failed:", error);
  }

  try {
    const crossrefUrl = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
    const crossrefResponse = await fetch(crossrefUrl, {
      headers: { "User-Agent": "ResearchRanker/1.0" },
      next: { revalidate: 21600 },
    });

    if (crossrefResponse.ok) {
      const data = await crossrefResponse.json();
      const message = data?.message || {};
      result.crossrefType = cleanText(message.type);
      result.publisher = cleanText(message.publisher);

      const relation =
        message.relation && typeof message.relation === "object" ? message.relation : {};
      result.correctionRelations = Object.entries(relation)
        .flatMap(([kind, entries]) =>
          Array.isArray(entries)
            ? entries
                .map((entry: { id?: string }) => `${kind}: ${cleanText(entry?.id)}`)
                .filter(Boolean)
            : []
        )
        .slice(0, 20);

      const rawUpdates = Array.isArray(message["update-to"])
        ? message["update-to"]
        : Array.isArray(message.updateTo)
          ? message.updateTo
          : [];

      result.updateNotices = rawUpdates
        .map((update: any) => ({
          type: cleanText(update?.type).toLowerCase(),
          label: cleanText(update?.label || update?.type),
          doi: cleanText(update?.DOI || update?.doi),
          source: cleanText(update?.source || "Crossref"),
          updated: cleanText(update?.updated?.["date-time"]),
        }))
        .filter((update: TrustResponse["updateNotices"][number]) =>
          Boolean(update.type || update.label || update.doi)
        )
        .slice(0, 20);

      const crossrefRetraction =
        result.updateNotices.some((update) => /retract/i.test(`${update.type} ${update.label}`)) ||
        result.correctionRelations.some((entry) => /retract/i.test(entry));

      if (crossrefRetraction) {
        result.retracted = true;
        result.retractionSource = "Crossref / Retraction Watch or publisher metadata";
        result.warnings.push(
          "Crossref metadata contains a retraction update or relation for this DOI. Treat the work as retracted unless the publisher record shows otherwise."
        );
      } else if (result.updateNotices.length > 0) {
        result.warnings.push(
          "Crossref reports post-publication updates for this DOI. Review the correction/update records before citing."
        );
      }

      result.evidence.push({
        label: "Crossref DOI metadata and update notices",
        source: "Crossref",
        url: `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
      });
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
    "ResearchRanker does not label a journal as predatory without a verifiable source; publisher, indexing, policy, and post-publication evidence are shown instead."
  );

  return Response.json(result);
}
