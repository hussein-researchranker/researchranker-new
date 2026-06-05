"use client";

import { useEffect, useRef, useState } from "react";

type NewsItem = {
  title: string;
  source: string;
  link: string;
  date: string;
  summary: string;
};

function cleanText(text: string) {
  return text
    ?.replaceAll("â€™", "’")
    .replaceAll("â€œ", "“")
    .replaceAll("â€", "”")
    .replaceAll("â€“", "–")
    .replaceAll("]]>", "")
    .trim();
}

export default function NewsSlider() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const sliderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function loadNews() {
      try {
        const res = await fetch("/api/news", { cache: "no-store" });
        const data = await res.json();
        setNews(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to load news:", error);
        setNews([]);
      } finally {
        setLoading(false);
      }
    }

    loadNews();
  }, []);

  const scrollSlider = (direction: "left" | "right") => {
    if (!sliderRef.current) return;

    sliderRef.current.scrollBy({
      left: direction === "right" ? 360 : -360,
      behavior: "smooth",
    });
  };

  return (
    <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase text-blue-700">
            Live Journal & Publishing News
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">
            Latest updates before you search
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Updated news about journals, indexing, retractions, open access,
            publishing ethics, and research integrity.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => scrollSlider("left")}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-lg font-bold shadow-sm hover:bg-slate-100"
            aria-label="Previous news"
          >
            ←
          </button>

          <button
            type="button"
            onClick={() => scrollSlider("right")}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-lg font-bold shadow-sm hover:bg-slate-100"
            aria-label="Next news"
          >
            →
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl bg-white p-5 text-slate-600">
          Loading news...
        </div>
      ) : news.length === 0 ? (
        <div className="rounded-xl bg-white p-5 text-slate-600">
          No news available now.
        </div>
      ) : (
        <div
          ref={sliderRef}
          className="flex snap-x snap-mandatory gap-4 overflow-x-hidden scroll-smooth"
        >
          {news.map((item, index) => (
            <article
              key={`${item.title}-${index}`}
              className="min-w-[320px] max-w-[320px] snap-start rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {cleanText(item.source)} • {item.date}
              </p>

              <h3 className="mt-3 line-clamp-3 text-lg font-bold text-slate-900">
                {cleanText(item.title)}
              </h3>

              <p className="mt-3 line-clamp-4 text-sm leading-6 text-slate-600">
                {cleanText(item.summary)}
              </p>

              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700"
              >
                Read source
              </a>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}