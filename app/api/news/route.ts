type NewsItem = {
  title: string;
  source: string;
  link: string;
  date: string;
  summary: string;
  scope: "global" | "iraq";
  provenance: "official" | "editorial";
};

const MAX_NEWS_ITEMS = 10;
const FETCH_TIMEOUT_MS = 8_000;

const globalFeeds = [
  {
    source: "The Scholarly Kitchen",
    url: "https://scholarlykitchen.sspnet.org/feed/",
    provenance: "editorial" as const,
  },
  {
    source: "Retraction Watch",
    url: "https://retractionwatch.com/feed/",
    provenance: "editorial" as const,
  },
];

const iraqiOfficialPages = [
  {
    source: "Iraqi Ministry of Higher Education",
    url: "https://mohesr.gov.iq/ar/",
  },
  {
    source: "Iraqi Ministry of Higher Education News",
    url: "https://mohesr.gov.iq/ar/homeNews/newsTerm_more/6",
  },
];

const iraqiPublishingKeywords = [
  "مجلة",
  "مجلات",
  "نشر",
  "بحثاً",
  "بحثا",
  "scopus",
  "clarivate",
  "q1",
  "q2",
  "q3",
  "q4",
  "فهرسة",
  "تصنيف",
];

function decodeHtml(text: string) {
  return text
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#8217;", "’")
    .replaceAll("&#8216;", "‘")
    .replaceAll("&#8220;", "“")
    .replaceAll("&#8221;", "”")
    .replaceAll("&#8212;", "—")
    .replaceAll("&#038;", "&")
    .replaceAll("&#39;", "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripHtml(text: string) {
  return decodeHtml(text.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function getTagValue(item: string, tag: string) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = item.match(regex);
  return match ? stripHtml(match[1]) : "";
}

function getLinkValue(item: string) {
  const link = getTagValue(item, "link");
  if (link) return link;

  const atomLink = item.match(/<link[^>]+href=["']([^"']+)["']/i);
  return atomLink ? atomLink[1] : "";
}

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
}

function parseRss(xml: string, source: string, provenance: "official" | "editorial"): NewsItem[] {
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  return items.map((item) => ({
    title: getTagValue(item, "title"),
    source,
    link: getLinkValue(item),
    date: formatDate(getTagValue(item, "pubDate")),
    summary: getTagValue(item, "description").slice(0, 320),
    scope: "global",
    provenance,
  }));
}

function absoluteUrl(base: string, href: string) {
  try {
    return new URL(href, base).toString();
  } catch {
    return "";
  }
}

function parseOfficialIraqiNews(html: string, source: string, baseUrl: string): NewsItem[] {
  const anchors = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];

  return anchors
    .map((match) => {
      const title = stripHtml(match[2]);
      const normalized = title.toLowerCase();
      const relevant = iraqiPublishingKeywords.some((keyword) => normalized.includes(keyword));

      if (!relevant || title.length < 18) return null;

      const link = absoluteUrl(baseUrl, match[1]);
      if (!link || !link.startsWith("https://mohesr.gov.iq/")) return null;

      return {
        title,
        source,
        link,
        date: "",
        summary: "خبر من المصدر الرسمي لوزارة التعليم العالي والبحث العلمي العراقية. افتح المصدر للتحقق من التفاصيل والتاريخ الكامل.",
        scope: "iraq" as const,
        provenance: "official" as const,
      };
    })
    .filter((item): item is NewsItem => Boolean(item));
}

function removeDuplicates(news: NewsItem[]) {
  const seen = new Set<string>();
  return news.filter((item) => {
    const key = `${item.title.toLowerCase()}|${item.link}`;
    if (!item.title || !item.link || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortByDateDesc(news: NewsItem[]) {
  return [...news].sort((a, b) => {
    const first = a.date ? new Date(a.date).getTime() : 0;
    const second = b.date ? new Date(b.date).getTime() : 0;
    return second - first;
  });
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "ResearchRanker/2.0 academic-news-aggregator",
      Accept: "text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    next: { revalidate: 60 * 30 },
  });

  if (!response.ok) return "";
  return response.text();
}

async function loadGlobalNews() {
  const responses = await Promise.allSettled(
    globalFeeds.map(async (feed) => {
      const xml = await fetchText(feed.url);
      return xml ? parseRss(xml, feed.source, feed.provenance) : [];
    })
  );

  const news = responses.flatMap((response) =>
    response.status === "fulfilled" ? response.value : []
  );

  return sortByDateDesc(removeDuplicates(news)).slice(0, MAX_NEWS_ITEMS);
}

async function loadIraqiNews() {
  const responses = await Promise.allSettled(
    iraqiOfficialPages.map(async (page) => {
      const html = await fetchText(page.url);
      return html ? parseOfficialIraqiNews(html, page.source, page.url) : [];
    })
  );

  const news = responses.flatMap((response) =>
    response.status === "fulfilled" ? response.value : []
  );

  return removeDuplicates(news).slice(0, MAX_NEWS_ITEMS);
}

export async function GET(request: Request) {
  try {
    const scope = new URL(request.url).searchParams.get("scope") || "global";

    if (scope === "iraq") {
      return Response.json(await loadIraqiNews());
    }

    if (scope === "all") {
      const [global, iraq] = await Promise.all([loadGlobalNews(), loadIraqiNews()]);
      return Response.json({ global, iraq, updatedAt: new Date().toISOString() });
    }

    return Response.json(await loadGlobalNews());
  } catch (error) {
    console.error("News API error:", error);
    return Response.json([], { status: 200 });
  }
}
