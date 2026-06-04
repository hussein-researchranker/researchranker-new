type NewsItem = {
  title: string;
  source: string;
  link: string;
  date: string;
  summary: string;
};

const MAX_NEWS_ITEMS = 8;

const feeds = [
  {
    source: "The Scholarly Kitchen",
    url: "https://scholarlykitchen.sspnet.org/feed/",
  },
  {
    source: "Retraction Watch",
    url: "https://retractionwatch.com/feed/",
  },
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
    .replaceAll("&#39;", "'");
}

function stripHtml(text: string) {
  return decodeHtml(text.replace(/<[^>]*>/g, " "))
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

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().slice(0, 10);
}

function parseRss(xml: string, source: string): NewsItem[] {
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  return items.map((item) => ({
    title: getTagValue(item, "title"),
    source,
    link: getLinkValue(item),
    date: formatDate(getTagValue(item, "pubDate")),
    summary: getTagValue(item, "description").slice(0, 260),
  }));
}

function removeDuplicates(news: NewsItem[]) {
  const seen = new Set<string>();

  return news.filter((item) => {
    const key = `${item.title}-${item.link}`;

    if (!item.title || !item.link || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function sortByDateDesc(news: NewsItem[]) {
  return [...news].sort((a, b) => {
    const first = new Date(a.date).getTime();
    const second = new Date(b.date).getTime();

    return second - first;
  });
}

export async function GET() {
  try {
    const responses = await Promise.allSettled(
      feeds.map(async (feed) => {
        const response = await fetch(feed.url, {
          next: { revalidate: 60 * 60 * 6 },
        });

        if (!response.ok) {
          return [];
        }

        const xml = await response.text();
        return parseRss(xml, feed.source);
      })
    );

    const news = responses.flatMap((response) =>
      response.status === "fulfilled" ? response.value : []
    );

    return Response.json(
      sortByDateDesc(removeDuplicates(news)).slice(0, MAX_NEWS_ITEMS)
    );
  } catch (error) {
    console.error("News API error:", error);
    return Response.json([], { status: 200 });
  }
}