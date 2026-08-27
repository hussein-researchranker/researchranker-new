import path from "path";
import { readFile } from "fs/promises";

export type Quartile = "Q1" | "Q2" | "Q3" | "Q4";

export type JournalVerificationResult = {
  query: {
    issn: string;
    title: string;
  };
  journal: {
    title: string;
    publisher: string;
    issn: string;
    eIssn: string;
    sourceId: string;
  };
  indexing: {
    scopus: "verified" | "not_checked" | "not_found" | "unavailable";
    clarivate: "not_checked" | "configured" | "unavailable";
  };
  metrics: {
    quartile: Quartile | null;
    sjr: string;
    snip: string;
    hIndex: string;
  };
  evidence: Array<{
    source: string;
    level: "direct" | "snapshot" | "metadata";
    matchedBy: "issn" | "title" | "none";
    note: string;
    sourceUrl?: string;
  }>;
  confidence: "direct+snapshot" | "direct" | "snapshot" | "metadata-only" | "unverified";
  limitations: string[];
};

type ScimagoJournal = {
  title: string;
  publisher: string;
  issns: string[];
  quartile: Quartile | null;
  sjr: string;
  hIndex: string;
};

type ScopusSerialEntry = {
  "dc:title"?: string;
  "dc:publisher"?: string;
  "source-id"?: string;
  "prism:issn"?: string;
  "prism:eIssn"?: string;
  SJRList?: { SJR?: Array<{ "@year"?: string; $?: string }> | { "@year"?: string; $?: string } };
  SNIPList?: { SNIP?: Array<{ "@year"?: string; $?: string }> | { "@year"?: string; $?: string } };
};

let scimagoCache: ScimagoJournal[] | null = null;

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function normalizeIssn(value: string) {
  const raw = cleanText(value).replace(/[^0-9xX]/g, "").toUpperCase();
  if (raw.length !== 8) return "";
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function isValidIssn(value: string) {
  const normalized = normalizeIssn(value).replace("-", "");
  if (normalized.length !== 8) return false;

  let sum = 0;
  for (let index = 0; index < 7; index += 1) {
    const digit = Number(normalized[index]);
    if (!Number.isInteger(digit)) return false;
    sum += digit * (8 - index);
  }

  const remainder = (11 - (sum % 11)) % 11;
  const expected = remainder === 10 ? "X" : String(remainder);
  return normalized[7] === expected;
}

function normalizeJournalTitle(value: string) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCsvLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === delimiter && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function detectDelimiter(header: string) {
  return (header.match(/;/g) || []).length > (header.match(/,/g) || []).length ? ";" : ",";
}

function getValue(row: Record<string, string>, names: string[]) {
  for (const name of names) {
    const value = cleanText(row[name]);
    if (value) return value;
  }
  return "";
}

function extractQuartile(row: Record<string, string>): Quartile | null {
  const value = getValue(row, ["SJR Best Quartile", "Best Quartile", "Quartile", "quartile"]);
  return /^Q[1-4]$/i.test(value) ? (value.toUpperCase() as Quartile) : null;
}

async function loadScimagoSnapshot() {
  if (scimagoCache) return scimagoCache;

  const filePath = path.join(process.cwd(), "data", "scimagojr.csv");
  const content = await readFile(filePath, "utf8");
  const lines = content.split(/\r?\n/).filter(Boolean);

  if (lines.length < 2) {
    scimagoCache = [];
    return scimagoCache;
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map((header) => cleanText(header).replace(/^\uFEFF/, ""));

  scimagoCache = lines.slice(1).flatMap((line) => {
    const values = parseCsvLine(line, delimiter);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });

    const title = getValue(row, ["Title", "title", "Journal", "journal"]);
    const issnText = getValue(row, ["Issn", "ISSN", "issn"]);
    const issns = issnText
      .split(/[,; ]+/)
      .map(normalizeIssn)
      .filter(Boolean);

    if (!title && issns.length === 0) return [];

    return [{
      title,
      publisher: getValue(row, ["Publisher", "publisher"]),
      issns,
      quartile: extractQuartile(row),
      sjr: getValue(row, ["SJR", "sjr"]),
      hIndex: getValue(row, ["H index", "H Index", "hIndex"]),
    }];
  });

  return scimagoCache;
}

function latestMetric(list: Array<{ "@year"?: string; $?: string }> | { "@year"?: string; $?: string } | undefined) {
  if (!list) return "";
  const values = Array.isArray(list) ? list : [list];
  return [...values]
    .sort((a, b) => Number(b["@year"] || 0) - Number(a["@year"] || 0))[0]?.$ || "";
}

async function fetchScopusByIssn(issn: string) {
  const apiKey = process.env.SCOPUS_API_KEY;
  if (!apiKey) return { status: "not_checked" as const, entry: null };

  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-ELS-APIKey": apiKey,
  };

  if (process.env.SCOPUS_INSTTOKEN) {
    headers["X-ELS-Insttoken"] = process.env.SCOPUS_INSTTOKEN;
  }

  try {
    const response = await fetch(
      `https://api.elsevier.com/content/serial/title/issn/${encodeURIComponent(issn)}?view=STANDARD`,
      {
        headers,
        signal: AbortSignal.timeout(8_000),
        cache: "no-store",
      }
    );

    if (response.status === 404) return { status: "not_found" as const, entry: null };
    if (!response.ok) return { status: "unavailable" as const, entry: null };

    const data = await response.json();
    const entries = data?.["serial-metadata-response"]?.entry;
    const entry = (Array.isArray(entries) ? entries[0] : entries) as ScopusSerialEntry | undefined;

    return entry
      ? { status: "verified" as const, entry }
      : { status: "not_found" as const, entry: null };
  } catch {
    return { status: "unavailable" as const, entry: null };
  }
}

export async function verifyJournal(input: { issn?: string; title?: string }): Promise<JournalVerificationResult> {
  const requestedIssn = normalizeIssn(input.issn || "");
  const requestedTitle = cleanText(input.title);
  const limitations: string[] = [];
  const evidence: JournalVerificationResult["evidence"] = [];

  if (input.issn && !requestedIssn) {
    limitations.push("ISSN format is invalid; quartile verification was not attempted by ISSN.");
  } else if (requestedIssn && !isValidIssn(requestedIssn)) {
    limitations.push("ISSN checksum is invalid; treat the identifier as untrusted until corrected.");
  }

  const snapshot = await loadScimagoSnapshot();
  const snapshotMatch = requestedIssn
    ? snapshot.find((journal) => journal.issns.includes(requestedIssn))
    : requestedTitle
      ? snapshot.find((journal) => normalizeJournalTitle(journal.title) === normalizeJournalTitle(requestedTitle))
      : undefined;

  if (snapshotMatch) {
    evidence.push({
      source: "SCImago local snapshot",
      level: "snapshot",
      matchedBy: requestedIssn ? "issn" : "title",
      note: requestedIssn
        ? "Exact ISSN match in the bundled SCImago dataset. This is a snapshot, not a live SCImago API response."
        : "Exact normalized title match in the bundled SCImago dataset. Title-only matches are not treated as sufficient for high-confidence quartile verification.",
      sourceUrl: "https://www.scimagojr.com/",
    });
  }

  const scopus = requestedIssn && isValidIssn(requestedIssn)
    ? await fetchScopusByIssn(requestedIssn)
    : { status: "not_checked" as const, entry: null };

  if (scopus.status === "verified" && scopus.entry) {
    evidence.push({
      source: "Scopus Serial Title API",
      level: "direct",
      matchedBy: "issn",
      note: "The serial title was retrieved directly from Elsevier's Scopus Serial Title API using the exact ISSN.",
      sourceUrl: scopus.entry["source-id"]
        ? `https://www.scopus.com/sourceid/${scopus.entry["source-id"]}`
        : "https://www.scopus.com/sources",
    });
  }

  const directEntry = scopus.entry;
  const directAndSnapshot = Boolean(directEntry && snapshotMatch && requestedIssn && snapshotMatch.issns.includes(requestedIssn));
  const snapshotByIssn = Boolean(snapshotMatch && requestedIssn && snapshotMatch.issns.includes(requestedIssn));

  if (!process.env.SCOPUS_API_KEY) {
    limitations.push("SCOPUS_API_KEY is not configured, so live Scopus indexing verification is unavailable.");
  }

  if (!process.env.CLARIVATE_API_KEY) {
    limitations.push("CLARIVATE_API_KEY is not configured. Web of Science/JCR verification therefore remains unavailable.");
  } else {
    limitations.push("Clarivate credentials are configured, but the paid Journals API adapter must be enabled with the licensed endpoint before JCR metrics can be treated as live evidence.");
  }

  if (snapshotMatch?.quartile) {
    limitations.push("The displayed Q value comes from the bundled SCImago snapshot. It should not be described as a live Scopus or Clarivate quartile unless a licensed live source confirms it.");
  }

  const result: JournalVerificationResult = {
    query: {
      issn: requestedIssn,
      title: requestedTitle,
    },
    journal: {
      title: cleanText(directEntry?.["dc:title"]) || snapshotMatch?.title || requestedTitle,
      publisher: cleanText(directEntry?.["dc:publisher"]) || snapshotMatch?.publisher || "",
      issn: normalizeIssn(directEntry?.["prism:issn"] || "") || requestedIssn,
      eIssn: normalizeIssn(directEntry?.["prism:eIssn"] || ""),
      sourceId: cleanText(directEntry?.["source-id"]),
    },
    indexing: {
      scopus: scopus.status,
      clarivate: process.env.CLARIVATE_API_KEY ? "configured" : "not_checked",
    },
    metrics: {
      quartile: snapshotByIssn ? snapshotMatch?.quartile || null : null,
      sjr: latestMetric(directEntry?.SJRList?.SJR) || (snapshotByIssn ? snapshotMatch?.sjr || "" : ""),
      snip: latestMetric(directEntry?.SNIPList?.SNIP),
      hIndex: snapshotByIssn ? snapshotMatch?.hIndex || "" : "",
    },
    evidence,
    confidence: directAndSnapshot
      ? "direct+snapshot"
      : directEntry
        ? "direct"
        : snapshotByIssn
          ? "snapshot"
          : snapshotMatch
            ? "metadata-only"
            : "unverified",
    limitations,
  };

  return result;
}
