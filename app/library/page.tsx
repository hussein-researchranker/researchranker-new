"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import Toast from "@/components/ui/Toast";
import type {
  LibraryArticle,
  ResearchCollection,
  ReadingStatus,
  ScreeningStatus,
} from "@/lib/research-types";

type ToastState = { message: string; tone: "success" | "error" | "info" };

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function articleKey(article: LibraryArticle) {
  return cleanText(article.id || article.doi || article.pmid || article.title);
}

function yearOf(value?: string) {
  return cleanText(value).match(/\b(19|20)\d{2}\b/)?.[0] || "n.d.";
}

function fileDownload(name: string, content: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function bibtexEntry(article: LibraryArticle, index: number) {
  const id = cleanText(article.doi || article.pmid || `researchranker${index + 1}`)
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .slice(0, 60);
  return `@article{${id},\n  title={${cleanText(article.title)}},\n  author={${cleanText(article.authors)}},\n  journal={${cleanText(article.journal)}},\n  year={${yearOf(article.pubdate)}},${article.doi ? `\n  doi={${cleanText(article.doi)}},` : ""}\n}`;
}

function risEntry(article: LibraryArticle) {
  const authors = cleanText(article.authors)
    .split(/,|;|\band\b/i)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((author) => `AU  - ${author}`)
    .join("\n");
  return [
    "TY  - JOUR",
    `TI  - ${cleanText(article.title)}`,
    authors,
    `JO  - ${cleanText(article.journal)}`,
    `PY  - ${yearOf(article.pubdate)}`,
    article.doi ? `DO  - ${cleanText(article.doi)}` : "",
    article.abstract ? `AB  - ${cleanText(article.abstract)}` : "",
    "ER  -",
  ]
    .filter(Boolean)
    .join("\n");
}

export default function LibraryPage() {
  const [articles, setArticles] = useState<LibraryArticle[]>([]);
  const [collections, setCollections] = useState<ResearchCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | ReadingStatus>("all");
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [newCollection, setNewCollection] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Partial<LibraryArticle>>>({});
  const [toast, setToast] = useState<ToastState | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [libraryResponse, collectionsResponse] = await Promise.all([
        fetch("/api/library/list", { cache: "no-store" }),
        fetch("/api/collections", { cache: "no-store" }),
      ]);
      const libraryData = await libraryResponse.json();
      const collectionData = await collectionsResponse.json();
      if (!libraryResponse.ok) throw new Error(libraryData?.error || "تعذر تحميل المكتبة.");
      setArticles(Array.isArray(libraryData?.articles) ? libraryData.articles : []);
      setCollections(Array.isArray(collectionData?.collections) ? collectionData.collections : []);
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "تعذر تحميل المكتبة.", tone: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles.filter((article) => {
      const haystack = [article.title, article.authors, article.journal, article.doi, article.pmid, ...(article.tags || [])]
        .map(cleanText)
        .join(" ")
        .toLowerCase();
      return (
        (!q || haystack.includes(q)) &&
        (status === "all" || article.readingStatus === status) &&
        (collectionFilter === "all" || article.collectionIds?.includes(collectionFilter)) &&
        (!favoritesOnly || article.favorite)
      );
    });
  }, [articles, query, status, collectionFilter, favoritesOnly]);

  async function updateArticle(article: LibraryArticle, patch: Partial<LibraryArticle>) {
    const id = articleKey(article);
    if (!id) return;
    try {
      const response = await fetch("/api/library/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "فشل تحديث المصدر.");
      setArticles((current) => current.map((item) => (articleKey(item) === id ? data.article : item)));
      setDrafts((current) => ({ ...current, [id]: {} }));
      setToast({ message: "تم تحديث بيانات المصدر.", tone: "success" });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "فشل تحديث المصدر.", tone: "error" });
    }
  }

  async function removeArticle(article: LibraryArticle) {
    const id = articleKey(article);
    if (!id || !confirm("حذف هذا المصدر من المكتبة؟")) return;
    const response = await fetch("/api/library/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (response.ok) {
      setArticles((current) => current.filter((item) => articleKey(item) !== id));
      setToast({ message: "تم حذف المصدر.", tone: "success" });
    } else {
      setToast({ message: "تعذر حذف المصدر.", tone: "error" });
    }
  }

  async function createCollection() {
    const name = newCollection.trim();
    if (!name) return;
    const response = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await response.json();
    if (response.ok) {
      setCollections((current) => [...current, data.collection].sort((a, b) => a.name.localeCompare(b.name)));
      setNewCollection("");
      setToast({ message: "تم إنشاء المجموعة.", tone: "success" });
    } else {
      setToast({ message: data?.error || "تعذر إنشاء المجموعة.", tone: "error" });
    }
  }

  function exportBibtex() {
    fileDownload("researchranker-library.bib", filtered.map(bibtexEntry).join("\n\n"), "application/x-bibtex;charset=utf-8");
  }

  function exportRis(filename = "researchranker-library.ris") {
    fileDownload(filename, filtered.map(risEntry).join("\n\n"), "application/x-research-info-systems;charset=utf-8");
  }

  function exportCsv() {
    const rows = [
      ["Title", "Authors", "Journal", "Year", "DOI", "PMID", "Reading status", "Tags", "Notes"],
      ...filtered.map((article) => [
        cleanText(article.title),
        cleanText(article.authors),
        cleanText(article.journal),
        yearOf(article.pubdate),
        cleanText(article.doi),
        cleanText(article.pmid),
        cleanText(article.readingStatus),
        (article.tags || []).join("; "),
        cleanText(article.notes),
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    fileDownload("researchranker-library.csv", `\uFEFF${csv}`, "text/csv;charset=utf-8");
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb]" dir="rtl">
      <AppHeader />
      {toast ? <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} /> : null}

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-l from-emerald-50 via-white to-blue-50 px-6 py-7 sm:px-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Research Library V2</p>
            <div className="mt-2 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-3xl font-black text-slate-950 sm:text-4xl">مكتبتي البحثية</h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  مجموعات، وسوم، ملاحظات، حالة قراءة، فرز للمراجعة المنهجية، وتصدير متوافق مع BibTeX وRIS وZotero.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={exportBibtex} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-black">BibTeX</button>
                <button onClick={() => exportRis()} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-black">RIS</button>
                <button onClick={() => exportRis("researchranker-zotero-import.ris")} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-black">Zotero RIS</button>
                <button onClick={exportCsv} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-black">CSV</button>
              </div>
            </div>
          </div>
          <div className="grid gap-px bg-slate-200 sm:grid-cols-4">
            <Stat label="المصادر" value={articles.length} />
            <Stat label="المفضلة" value={articles.filter((a) => a.favorite).length} />
            <Stat label="قيد القراءة" value={articles.filter((a) => a.readingStatus === "reading").length} />
            <Stat label="المجموعات" value={collections.length} />
          </div>
        </section>

        <section className="mt-6 grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1.3fr_repeat(3,auto)]">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بالعنوان، المؤلف، DOI، PMID أو الوسم..." className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-500" />
          <select value={status} onChange={(event) => setStatus(event.target.value as "all" | ReadingStatus)} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold">
            <option value="all">كل حالات القراءة</option><option value="to-read">للقراءة</option><option value="reading">قيد القراءة</option><option value="read">مقروء</option>
          </select>
          <select value={collectionFilter} onChange={(event) => setCollectionFilter(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold">
            <option value="all">كل المجموعات</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
          </select>
          <button onClick={() => setFavoritesOnly((value) => !value)} className={`rounded-xl border px-4 py-3 text-sm font-black ${favoritesOnly ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-300 bg-white text-slate-700"}`}>★ المفضلة</button>
        </section>

        <section className="mt-5 flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 sm:flex-row sm:items-center">
          <input value={newCollection} onChange={(event) => setNewCollection(event.target.value)} onKeyDown={(event) => event.key === "Enter" && createCollection()} placeholder="اسم مجموعة جديدة، مثل: مراجعة Zonulin" className="min-w-0 flex-1 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold outline-none" />
          <button onClick={createCollection} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white">إنشاء مجموعة</button>
          <Link href="/review" className="rounded-xl border border-blue-200 bg-white px-5 py-3 text-center text-sm font-black text-blue-700">مساحة المراجعة المنهجية</Link>
          <Link href="/assistant" className="rounded-xl border border-blue-200 bg-white px-5 py-3 text-center text-sm font-black text-blue-700">المساعد البحثي</Link>
        </section>

        {loading ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">{[1, 2, 3, 4].map((item) => <div key={item} className="h-72 animate-pulse rounded-3xl border border-slate-200 bg-white" />)}</div>
        ) : filtered.length === 0 ? (
          <section className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <h2 className="text-xl font-black text-slate-900">لا توجد مصادر مطابقة</h2>
            <p className="mt-2 text-sm text-slate-500">ابدأ من البحث العلمي واحفظ الأوراق المهمة ثم نظّمها هنا.</p>
            <Link href="/search" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white">إضافة مصادر</Link>
          </section>
        ) : (
          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            {filtered.map((article) => {
              const id = articleKey(article);
              const draft = drafts[id] || {};
              const collectionIds = draft.collectionIds || article.collectionIds || [];
              return (
                <article key={id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-blue-700">{cleanText(article.journal) || "مجلة غير محددة"} • {yearOf(article.pubdate)}</p>
                      <h2 className="mt-2 text-lg font-black leading-7 text-slate-950">{cleanText(article.title) || "Untitled article"}</h2>
                      <p className="mt-2 line-clamp-2 text-xs leading-6 text-slate-500">{cleanText(article.authors)}</p>
                    </div>
                    <button onClick={() => updateArticle(article, { favorite: !article.favorite })} className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border text-lg ${article.favorite ? "border-amber-300 bg-amber-50 text-amber-600" : "border-slate-200 bg-white text-slate-400"}`} aria-label="المفضلة">★</button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold">
                    {article.doi ? <span className="rounded-full bg-slate-100 px-3 py-1.5">DOI {article.doi}</span> : null}
                    {article.quartile ? <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">{article.quartile}</span> : null}
                    {(article.tags || []).map((tag) => <span key={tag} className="rounded-full bg-violet-50 px-3 py-1.5 text-violet-700">#{tag}</span>)}
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-bold text-slate-600">حالة القراءة
                      <select value={(draft.readingStatus || article.readingStatus || "to-read") as string} onChange={(event) => setDrafts((current) => ({ ...current, [id]: { ...current[id], readingStatus: event.target.value as ReadingStatus } }))} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
                        <option value="to-read">للقراءة</option><option value="reading">قيد القراءة</option><option value="read">مقروء</option>
                      </select>
                    </label>
                    <label className="text-xs font-bold text-slate-600">قرار المراجعة
                      <select value={(draft.screeningStatus || article.screeningStatus || "unscreened") as string} onChange={(event) => setDrafts((current) => ({ ...current, [id]: { ...current[id], screeningStatus: event.target.value as ScreeningStatus } }))} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
                        <option value="unscreened">غير مفحوص</option><option value="include">Include</option><option value="maybe">Maybe</option><option value="exclude">Exclude</option>
                      </select>
                    </label>
                  </div>

                  <label className="mt-3 block text-xs font-bold text-slate-600">الوسوم
                    <input defaultValue={(article.tags || []).join(", ")} onChange={(event) => setDrafts((current) => ({ ...current, [id]: { ...current[id], tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) } }))} placeholder="biomarker, meta-analysis" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
                  </label>

                  <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <summary className="cursor-pointer text-xs font-black text-slate-700">إضافة إلى مجموعات</summary>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {collections.map((collection) => {
                        const checked = collectionIds.includes(collection.id);
                        return <label key={collection.id} className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={checked} onChange={() => { const next = checked ? collectionIds.filter((value) => value !== collection.id) : [...collectionIds, collection.id]; setDrafts((current) => ({ ...current, [id]: { ...current[id], collectionIds: next } })); }} />{collection.name}</label>;
                      })}
                    </div>
                  </details>

                  <label className="mt-3 block text-xs font-bold text-slate-600">ملاحظات الباحث
                    <textarea value={(draft.notes ?? article.notes ?? "") as string} onChange={(event) => setDrafts((current) => ({ ...current, [id]: { ...current[id], notes: event.target.value } }))} rows={3} className="mt-1 w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5 text-sm" placeholder="لماذا هذه الورقة مهمة؟ نقاط القوة، القيود، نتائج تحتاج اقتباساً..." />
                  </label>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => updateArticle(article, draft)} className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white">حفظ التنظيم</button>
                    <Link href={`/article?doi=${encodeURIComponent(cleanText(article.doi))}&id=${encodeURIComponent(id)}`} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-black text-slate-700">تفاصيل الورقة</Link>
                    {article.doi ? <Link href={`/graph?doi=${encodeURIComponent(article.doi)}`} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-black text-slate-700">خريطة العلاقات</Link> : null}
                    <button onClick={() => removeArticle(article)} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-black text-red-700">حذف</button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="bg-white px-6 py-5"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-slate-950">{value}</p></div>;
}
