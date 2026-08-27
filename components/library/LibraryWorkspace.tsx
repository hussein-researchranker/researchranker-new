"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { useEffect, useMemo, useRef, useState } from "react";

type LibraryArticle = {
  id?: string;
  pmid?: string;
  title?: string;
  journal?: string;
  pubdate?: string;
  authors?: string;
  doi?: string;
  abstract?: string;
  source?: string;
  sourceUrl?: string;
  pubmedUrl?: string;
  quartile?: string;
  indexingStatus?: string;
  sjr?: string;
  hIndex?: string;
  publisher?: string;
  issn?: string;
  matchConfidence?: string;
  savedAt?: string;
};

type LibraryResponse = {
  articles?: LibraryArticle[];
  storage?: string;
  error?: string;
  code?: string;
};

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function articleKey(article: LibraryArticle, index = 0) {
  return cleanText(article.id) || cleanText(article.doi) || cleanText(article.pmid) || `${cleanText(article.title)}-${index}`;
}

function verifiedQuartile(article: LibraryArticle) {
  const value = cleanText(article.quartile);
  const confidence = cleanText(article.matchConfidence).toLowerCase();
  return /^Q[1-4]$/.test(value) && confidence.includes("issn exact match") ? value : "";
}

function qClass(value: string) {
  if (value === "Q1") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (value === "Q2") return "border-blue-200 bg-blue-50 text-blue-800";
  if (value === "Q3") return "border-amber-200 bg-amber-50 text-amber-800";
  if (value === "Q4") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

export default function LibraryWorkspace() {
  const [articles, setArticles] = useState<LibraryArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const filterRef = useRef<HTMLInputElement | null>(null);

  async function loadLibrary() {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/library/list", { cache: "no-store" });
      const data = (await response.json()) as LibraryResponse;

      if (!response.ok) {
        throw new Error(data.error || "Failed to load your library.");
      }

      setArticles(Array.isArray(data.articles) ? data.articles : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل المكتبة.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLibrary();

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (event.key === "/" && !typing) {
        event.preventDefault();
        filterRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return articles;

    return articles.filter((article) =>
      [article.title, article.journal, article.authors, article.doi, article.issn, article.publisher]
        .map(cleanText)
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [articles, filter]);

  const withDoi = useMemo(() => articles.filter((article) => cleanText(article.doi)).length, [articles]);
  const verifiedQ = useMemo(() => articles.filter((article) => verifiedQuartile(article)).length, [articles]);

  async function removeArticle(article: LibraryArticle, index: number) {
    const key = articleKey(article, index);
    if (!key) return;

    try {
      setDeleting((current) => ({ ...current, [key]: true }));
      setError("");

      const response = await fetch("/api/library/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: article.id || key }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Delete failed.");
      }

      setArticles((current) => current.filter((item, itemIndex) => articleKey(item, itemIndex) !== key));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر حذف المصدر.");
    } finally {
      setDeleting((current) => ({ ...current, [key]: false }));
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 sm:px-6 sm:py-7" dir="rtl">
      <section className="mx-auto max-w-7xl">
        <header className="sticky top-3 z-30 mb-5 flex items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-xl">
          <Link href="/dashboard" className="flex items-center gap-3 rounded-xl">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-sm font-black text-white">R</div>
            <div>
              <p className="text-sm font-black text-slate-950">ResearchRanker</p>
              <p className="hidden text-xs text-slate-500 sm:block">My Research Library</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link href="/search" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white">بحث جديد</Link>
            <UserButton />
          </div>
        </header>

        <section className="rounded-[30px] border border-slate-200 bg-slate-950 p-5 text-white shadow-xl sm:p-7">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">Research workspace</p>
              <h1 className="mt-2 text-3xl font-black">مكتبتي البحثية</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">المصادر المحفوظة مرتبطة بحسابك. إذا تعطل التخزين الدائم، تظهر رسالة صريحة ولا ندّعي أن الحفظ نجح.</p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3"><p className="text-xl font-black">{articles.length}</p><p className="mt-1 text-[11px] text-slate-400">محفوظ</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3"><p className="text-xl font-black">{withDoi}</p><p className="mt-1 text-[11px] text-slate-400">بـ DOI</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3"><p className="text-xl font-black">{verifiedQ}</p><p className="mt-1 text-[11px] text-slate-400">Q بـISSN</p></div>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <input
                ref={filterRef}
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="فلترة بالعنوان، المجلة، المؤلف، DOI أو ISSN"
                className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pe-12 text-sm font-bold outline-none focus:border-blue-300 focus:bg-white"
              />
              <kbd className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-black text-slate-400 sm:block">/</kbd>
            </div>
            <button type="button" onClick={() => void loadLibrary()} className="min-h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">تحديث المكتبة</button>
          </div>
        </section>

        {error ? (
          <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-7 text-amber-900">
            {error}
          </section>
        ) : null}

        {loading ? (
          <div className="mt-5 space-y-4">{[0, 1, 2].map((item) => <div key={item} className="h-48 animate-pulse rounded-[28px] bg-slate-200" />)}</div>
        ) : filtered.length === 0 ? (
          <section className="mt-5 rounded-[28px] border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-black text-slate-950">{articles.length ? "لا توجد نتائج مطابقة للفلتر" : "لا توجد مصادر محفوظة حالياً"}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">{articles.length ? "غيّر كلمات الفلترة أو امسح الحقل." : "ابدأ بحثاً واحفظ المصادر المهمة لتظهر هنا."}</p>
            <Link href="/search" className="mt-4 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white">الذهاب إلى البحث</Link>
          </section>
        ) : (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {filtered.map((article, index) => {
              const key = articleKey(article, index);
              const q = verifiedQuartile(article);
              const sourceLink = cleanText(article.sourceUrl) || (article.doi ? `https://doi.org/${cleanText(article.doi)}` : cleanText(article.pubmedUrl));
              const journalParams = new URLSearchParams();
              if (article.issn) journalParams.set("issn", article.issn.split(",")[0].trim());
              if (article.journal) journalParams.set("title", article.journal);

              return (
                <article key={key} className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{cleanText(article.source) || "Saved source"}{article.savedAt ? ` • ${new Date(article.savedAt).toLocaleDateString()}` : ""}</p>
                      <h2 className="mt-2 text-xl font-black leading-8 text-slate-950">{cleanText(article.title) || "Untitled article"}</h2>
                      <p className="mt-2 text-sm leading-7 text-slate-600">{cleanText(article.authors) || "Authors unavailable"}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-black ${qClass(q)}`}>{q || "Q غير مؤكد"}</span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[11px] font-black text-slate-400">المجلة</p><p className="mt-1 text-sm font-black text-slate-900">{cleanText(article.journal) || "—"}</p></div>
                    <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[11px] font-black text-slate-400">DOI / PMID</p><p className="mt-1 break-all text-xs font-black text-slate-900">{cleanText(article.doi) || cleanText(article.pmid) || "—"}</p></div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {sourceLink ? <a href={sourceLink} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white">فتح المصدر</a> : null}
                    {(article.issn || article.journal) ? <Link href={`/journals?${journalParams.toString()}`} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-black text-blue-800">تحقق من المجلة</Link> : null}
                    <button type="button" onClick={() => void removeArticle(article, index)} disabled={deleting[key]} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-black text-rose-800 disabled:opacity-50">{deleting[key] ? "يحذف..." : "حذف"}</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
