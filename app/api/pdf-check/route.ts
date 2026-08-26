import { auth } from "@clerk/nextjs/server";
import { checkRateLimit } from "@/lib/rate-limit";

type UnpaywallLocation = {
  url?: string;
  url_for_pdf?: string;
  url_for_landing_page?: string;
  host_type?: string;
  version?: string;
  license?: string;
  is_best?: boolean;
};

type UnpaywallResponse = {
  doi?: string;
  title?: string;
  is_oa?: boolean;
  oa_status?: string;
  best_oa_location?: UnpaywallLocation | null;
  oa_locations?: UnpaywallLocation[];
};

const UNPAYWALL_TIMEOUT_MS = 12_000;
const PDF_CHECK_LIMIT_PER_MINUTE = 60;

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeDoi(value: string) {
  return cleanText(value)
    .replace(/^https?:\/\/doi\.org\//i, "")
    .replace(/^doi:/i, "")
    .trim();
}

function isValidDoi(value: string) {
  return /^10\.\d{4,9}\/\S+$/i.test(value);
}

function pickBestPdfLocation(data: UnpaywallResponse) {
  if (data.best_oa_location?.url_for_pdf) {
    return data.best_oa_location;
  }

  const locations = Array.isArray(data.oa_locations) ? data.oa_locations : [];

  return (
    locations.find((location) => location.url_for_pdf) ||
    data.best_oa_location ||
    locations[0] ||
    null
  );
}

function isTimeoutError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        {
          available: false,
          error: "You must sign in to check PDF/Open Access status.",
        },
        { status: 401 }
      );
    }

    const rateLimit = await checkRateLimit({
      key: `pdf-check:${userId}`,
      limit: PDF_CHECK_LIMIT_PER_MINUTE,
      windowSeconds: 60,
    });

    if (!rateLimit.success) {
      return Response.json(
        {
          available: false,
          error: "PDF/Open Access rate limit reached. Please try again shortly.",
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    const { searchParams } = new URL(request.url);

    const doi = normalizeDoi(
      searchParams.get("doi") || searchParams.get("DOI") || ""
    );

    if (!doi || !isValidDoi(doi)) {
      return Response.json(
        {
          available: false,
          error: "Missing or invalid DOI.",
        },
        { status: 400 }
      );
    }

    const email = cleanText(
      process.env.UNPAYWALL_EMAIL ||
        process.env.RESEARCHRANKER_CONTACT_EMAIL ||
        process.env.NEXT_PUBLIC_CONTACT_EMAIL ||
        ""
    );

    if (!email) {
      return Response.json(
        {
          available: false,
          error:
            "Unpaywall contact email is not configured. Set UNPAYWALL_EMAIL in Vercel Environment Variables.",
        },
        { status: 503 }
      );
    }

    const params = new URLSearchParams({
      email,
    });

    const response = await fetch(
      `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?${params}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": `ResearchRanker/1.0 (mailto:${email})`,
        },
        next: {
          revalidate: 60 * 60 * 24,
        },
        signal: AbortSignal.timeout(UNPAYWALL_TIMEOUT_MS),
      }
    );

    if (response.status === 404) {
      return Response.json({
        available: false,
        doi,
        isOpenAccess: false,
        oaStatus: "not_found",
        message: "No Open Access record was found for this DOI.",
      });
    }

    const data = (await response.json()) as UnpaywallResponse;

    if (!response.ok) {
      return Response.json(
        {
          available: false,
          doi,
          error: "Unpaywall request failed.",
        },
        { status: response.status }
      );
    }

    const location = pickBestPdfLocation(data);
    const pdfUrl = cleanText(location?.url_for_pdf);
    const landingPageUrl = cleanText(
      location?.url_for_landing_page || location?.url || ""
    );

    if (data.is_oa && pdfUrl) {
      return Response.json({
        available: true,
        doi,
        isOpenAccess: true,
        oaStatus: cleanText(data.oa_status || "open"),
        pdfUrl,
        landingPageUrl,
        license: cleanText(location?.license),
        version: cleanText(location?.version),
        hostType: cleanText(location?.host_type),
        message: "Open Access PDF is available.",
      });
    }

    if (data.is_oa && landingPageUrl) {
      return Response.json({
        available: false,
        doi,
        isOpenAccess: true,
        oaStatus: cleanText(data.oa_status || "open"),
        pdfUrl: "",
        landingPageUrl,
        license: cleanText(location?.license),
        version: cleanText(location?.version),
        hostType: cleanText(location?.host_type),
        message:
          "Open Access landing page is available, but a direct PDF URL was not found.",
      });
    }

    return Response.json({
      available: false,
      doi,
      isOpenAccess: Boolean(data.is_oa),
      oaStatus: cleanText(data.oa_status || "closed"),
      pdfUrl: "",
      landingPageUrl,
      message:
        "No legal Open Access PDF was found for this DOI through Unpaywall.",
    });
  } catch (error) {
    console.error("PDF check route error:", error);

    if (isTimeoutError(error)) {
      return Response.json(
        {
          available: false,
          error: "PDF/Open Access check timed out. Please try again.",
        },
        { status: 504 }
      );
    }

    return Response.json(
      {
        available: false,
        error: "PDF check failed because of a server error.",
      },
      { status: 500 }
    );
  }
}
