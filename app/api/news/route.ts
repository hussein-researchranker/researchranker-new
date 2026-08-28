type NewsItem = {
  title: string;
  source: string;
  link: string;
  date: string;
  summary: string;
};

const MAX_NEWS_ITEMS = 12;
const FEED_TIMEOUT_MS = 9_000;

const feeds = [
  {
    source: "The Scholarly Kitchen",
    url: "https://scholarlykitchen.sspnet.org/feed/",
  },
  {
    source: "Retraction Watch",
    url: "https://retractionwatch.com/feed/",
  },
  {
    source: "Crossref",
    url: "https://www.crossref.org/blog/index.xml",
  },
];

function decodeHtml(text: string) {
  return text
    .replaceAll("<![CDATA[", "")
    .replaceAll("]]>", "")
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
    .replace(/&#(\d+);/g, (_, code: string) => {
      const value = Number(code);
      return Number.isFinite(value) ? String.fromCodePoint(value) : "";
    });
}

function stripHtml(text: string) {
  return decodeHtml(text.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function getTagValue(item: string, tag: string) {
  const escaped = tag.replace(":", "\\:");
  const regex = new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i");
  const match = item.match(regex);
  return match ? stripHtml(match[1]) : "";
}

function getLinkValue(item: string) {
  const link = getTagValue(item, "link");
  if (link) return link;

  const atomLink = item.match(/<link[^>]+href=["']([^"']+)["']/i);
  return atomLink ? atomLink[1].trim() : "";
}

function safeExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function parseRss(xml: string, source: string): NewsItem[] {
  const rssItems = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  const atomEntries = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  const items = rssItems.length ? rssItems : atomEntries;

  return items.map((item) => {
    const title = getTagValue(item, "title");
    const link = safeExternalUrl(getLinkValue(item));
    const date = formatDate(
      getTagValue(item, "pubDate") ||
        getTagValue(item, "published") ||
        getTagValue(item, "updated") ||
        getTagValue(item, "dc:date")
    );
    const summary = (
      getTagValue(item, "description") ||
      getTagValue(item, "summary") ||
      getTagValue(item, "content")
    ).slice(0, 320);

    return { title, source, link, date, summary };
  });
}

function removeDuplicates(news: NewsItem[]) {
  const seen = new Set<string>();

  return news.filter((item) => {
    const normalizedTitle = item.title.toLowerCase().replace(/\s+/g, " ").trim();
    const key = item.link || normalizedTitle;

    if (!item.title || !item.link || !key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortByDateDesc(news: NewsItem[]) {
  return [...news].sort((a, b) => {
    const first = new Date(a.date).getTime();
    const second = new Date(b.date).getTime();
    const safeFirst = Number.isFinite(first) ? first : 0;
    const safeSecond = Number.isFinite(second) ? second : 0;
    return safeSecond - safeFirst;
  });
}

export async function GET() {
  try {
    const responses = await Promise.allSettled(
      feeds.map(async (feed) => {
        const response = await fetch(feed.url, {
          next: { revalidate: 60 * 60 * 3 },
          signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
          headers: {
            Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
            "User-Agent": "ResearchRanker/1.0 scholarly-news-reader",
          },
        });

        if (!response.ok) return [];

        const xml = await response.text();
        return parseRss(xml.slice(0, 2_000_000), feed.source);
      })
    );

    const news = responses.flatMap((response) =>
      response.status === "fulfilled" ? response.value : []
    );

    return Response.json(
      sortByDateDesc(removeDuplicates(news)).slice(0, MAX_NEWS_ITEMS),
      {
        headers: {
          "Cache-Control": "public, s-maxage=10800, stale-while-revalidate=21600",
        },
      }
    );
  } catch (error) {
    console.error("News API error:", error);
    return Response.json([], {
      status: 200,
      headers: { "Cache-Control": "public, max-age=300" },
    });
  }
}
