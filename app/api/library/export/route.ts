import { auth } from "@clerk/nextjs/server";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

type LibraryArticle = {
  id?: string;
  pmid?: string;
  title?: string;
  journal?: string;
  pubdate?: string;
  authors?: string;
  doi?: string;
  abstract?: string;
  sourceUrl?: string;
  pubmedUrl?: string;
  publisher?: string;
  issn?: string;
  collection?: string;
  tags?: string[];
};

type ExportFormat = "bibtex" | "ris" | "csl-json";

function clean(value: unknown, max = 12000) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function yearOf(value: unknown) {
  return clean(value, 100).match(/\b(19|20)\d{2}\b/)?.[0] || "";
}

function dateParts(value: unknown) {
  const raw = clean(value, 100);
  const match = raw.match(/\b((?:19|20)\d{2})(?:[-\/]([01]?\d))?(?:[-\/]([0-3]?\d))?/);
  if (!match) return undefined;
  const parts = [Number(match[1])];
  if (match[2]) parts.push(Number(match[2]));
  if (match[3]) parts.push(Number(match[3]));
  return [parts];
}

function authorsOf(value: unknown) {
  return clean(value, 4000)
    .split(/\s*;\s*|\s*,\s*(?=[A-ZÀ-ÖØ-Þ\u0600-\u06FF])/u)
    .map((author) => author.trim())
    .filter(Boolean)
    .slice(0, 50);
}

function bibEscape(value: unknown) {
  return clean(value).replace(/[{}]/g, "");
}

function bibKey(article: LibraryArticle, index: number) {
  const firstAuthor = authorsOf(article.authors)[0] || "researchranker";
  const surname = firstAuthor.split(/\s+/).at(-1)?.replace(/[^\p{L}\p{N}]/gu, "") || "item";
  return `${surname}${yearOf(article.pubdate) || "nd"}${index + 1}`;
}

function toBibTeX(articles: LibraryArticle[]) {
  return articles
    .map((article, index) => {
      const fields = [
        ["title", bibEscape(article.title)],
        ["author", authorsOf(article.authors).map(bibEscape).join(" and ")],
        ["journal", bibEscape(article.journal)],
        ["year", yearOf(article.pubdate)],
        ["doi", bibEscape(article.doi)],
        ["issn", bibEscape(article.issn)],
        ["publisher", bibEscape(article.publisher)],
        ["url", bibEscape(article.sourceUrl || article.pubmedUrl)],
        ["abstract", bibEscape(article.abstract)],
        ["note", article.pmid ? `PMID: ${bibEscape(article.pmid)}` : ""],
      ].filter(([, value]) => Boolean(value));

      return `@article{${bibKey(article, index)},\n${fields
        .map(([key, value]) => `  ${key} = {${value}}`)
        .join(",\n")}\n}`;
    })
    .join("\n\n");
}

function toRis(articles: LibraryArticle[]) {
  return articles
    .map((article) => {
      const lines = ["TY  - JOUR"];
      if (article.title) lines.push(`TI  - ${clean(article.title)}`);
      authorsOf(article.authors).forEach((author) => lines.push(`AU  - ${author}`));
      if (article.journal) lines.push(`JO  - ${clean(article.journal)}`);
      if (yearOf(article.pubdate)) lines.push(`PY  - ${yearOf(article.pubdate)}`);
      if (article.doi) lines.push(`DO  - ${clean(article.doi)}`);
      if (article.pmid) lines.push(`AN  - PMID:${clean(article.pmid)}`);
      if (article.issn) lines.push(`SN  - ${clean(article.issn)}`);
      if (article.publisher) lines.push(`PB  - ${clean(article.publisher)}`);
      if (article.abstract) lines.push(`AB  - ${clean(article.abstract)}`);
      if (article.sourceUrl || article.pubmedUrl) {
        lines.push(`UR  - ${clean(article.sourceUrl || article.pubmedUrl)}`);
      }
      lines.push("ER  -");
      return lines.join("\n");
    })
    .join("\n\n");
}

function toCslJson(articles: LibraryArticle[]) {
  return articles.map((article, index) => {
    const issued = dateParts(article.pubdate);
    const pmidNote = article.pmid ? `PMID: ${clean(article.pmid)}` : undefined;

    return {
      id: clean(article.doi || article.pmid || article.id || `researchranker-${index + 1}`),
      type: "article-journal",
      title: clean(article.title),
      author: authorsOf(article.authors).map((literal) => ({ literal })),
      "container-title": clean(article.journal),
      ...(issued ? { issued: { "date-parts": issued } } : {}),
      DOI: clean(article.doi) || undefined,
      ISSN: clean(article.issn) || undefined,
      publisher: clean(article.publisher) || undefined,
      URL: clean(article.sourceUrl || article.pubmedUrl) || undefined,
      abstract: clean(article.abstract) || undefined,
      note: pmidNote,
    };
  });
}

function responseHeaders(filename: string, contentType: string) {
  return {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store, max-age=0",
  };
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const requestedFormat = clean(searchParams.get("format"), 20) as ExportFormat;
    const format: ExportFormat = ["bibtex", "ris", "csl-json"].includes(requestedFormat)
      ? requestedFormat
      : "csl-json";
    const collection = clean(searchParams.get("collection"), 120);

    const ids = (await redis.smembers(`library:${userId}:ids`)) as string[];
    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.json({ error: "Library is empty." }, { status: 404 });
    }

    const values = (await redis.mget(
      ...ids.slice(0, 2000).map((id) => `library:${userId}:article:${id}`)
    )) as Array<LibraryArticle | null>;

    const articles = values
      .filter((item): item is LibraryArticle => Boolean(item))
      .filter((article) => !collection || clean(article.collection) === collection)
      .sort((a, b) => clean(a.title).localeCompare(clean(b.title)));

    if (articles.length === 0) {
      return Response.json({ error: "No library items match this export." }, { status: 404 });
    }

    const stamp = new Date().toISOString().slice(0, 10);

    if (format === "bibtex") {
      return new Response(toBibTeX(articles), {
        headers: responseHeaders(`researchranker-${stamp}.bib`, "application/x-bibtex; charset=utf-8"),
      });
    }

    if (format === "ris") {
      return new Response(toRis(articles), {
        headers: responseHeaders(`researchranker-${stamp}.ris`, "application/x-research-info-systems; charset=utf-8"),
      });
    }

    return new Response(JSON.stringify(toCslJson(articles), null, 2), {
      headers: responseHeaders(`researchranker-${stamp}.json`, "application/json; charset=utf-8"),
    });
  } catch (error) {
    console.error("Library export error:", error);
    return Response.json({ error: "Failed to export library." }, { status: 500 });
  }
}
