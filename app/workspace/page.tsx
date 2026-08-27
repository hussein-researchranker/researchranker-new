"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import Toast from "@/components/ui/Toast";

type Article = {
  id?: string;
  pmid?: string;
  title?: string;
  journal?: string;
  pubdate?: string;
  authors?: string;
  doi?: string;
  abstract?: string;
  quartile?: string;
  sjr?: string;
  hIndex?: string;
  publisher?: string;
  issn?: string;
  matchConfidence?: string;
  favorite?: boolean;
  readingStatus?: "to-read" | "reading" | "read";
  notes?: string;
  tags?: string[];
  collection?: string;
  screeningStatus?: "include" | "exclude" | "maybe" | "unscreened";
  exclusionReason?: string;
  extraction?: Record<string, string>;
};

type SavedSearch = {
  id: string;
  query: string;
  quartile: string;
  field: string;
  alertEnabled: boolean;
  createdAt: string;
};

type Tab = "library" | "searches" | "review" | "assistant" | "journals";

type ToastState = { message: string; tone: "success" | "error" | "info" };

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function articleId(article: Article) {
  return clean(article.id || article.doi || article.pmid || article.title);
}

function downloadText(filename: string, content: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function bibtex(articles: Article[]) {
  return articles
    .map((article, index) => {
      const key = `researchranker${index + 1}`;
      const year = clean(article.pubdate).match(/\b(19|20)\d{2}\b/)?.[0] || "";
      return `@article{${key},\n  title={${clean(article.title)}},\n  author={${clean(article.authors)}},\n  journal={${clean(article.journal)}},\n  year={${year}},\n  doi={${clean(article.doi)}}\n}`;
    })
    .join("\n\n");
}

function ris(articles: Article[]) {
  return articles
    .map((article) => {
      const year = clean(article.pubdate).match(/\b(19|20)\d{2}\b/)?.[0] || "";
      const authors = clean(article.authors)
        .split(/,\s*/)
        .filter(Boolean)
        .map((author) => `AU  - ${author}`)
        .join("\n");
      return `TY  - JOUR\nTI  - ${clean(article.title)}\n${authors}\nJO  - ${clean(article.journal)}\nPY  - ${year}\nDO  - ${clean(article.doi)}\nER  -`;
    })
    .join("\n\n");
}

export default function WorkspacePage() {
  const [tab, setTab] = useState<Tab>("library");
  const [articles, setArticles] = useState<Article[]>([]);
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [filter, setFilter] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("All");
  const [selectedForAi, setSelectedForAi] = useState<Set<string>>(new Set());
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);
  const [journalQuery, setJournalQuery] = useState("");
  const [journals, setJournals] = useState<Array<Record<string, unknown>>>([]);
  const [findingJournals, setFindingJournals] = useState(false);

  async function loadAll() {
    try {
      setLoading(true);
      const [libraryResponse, searchesResponse] = await Promise.all([
        fetch("/api/library/list", { cache: "no-store" }),
        fetch("/api/saved-searches", { cache: "no-store" }),
      ]);
      if (libraryResponse.ok) {
        const data = await libraryResponse.json();
        setArticles(Array.isArray(data?.articles) ? data.articles : []);
      }
      if (searchesResponse.ok) {
        const data = await searchesResponse.json();
        setSearches(Array.isArray(data?.searches) ? data.searches : []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const collections = useMemo(
    () => ["All", ...Array.from(new Set(articles.map((a) => clean(a.collection) || "Unsorted")))],
    [articles]
  );

  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    return articles.filter((article) => {
      const collection = clean(article.collection) || "Unsorted";
      const inCollection = collectionFilter === "All" || collection === collectionFilter;
      const haystack = [article.title, article.authors, article.journal, article.doi, ...(article.tags || [])]
        .map(clean)
        .join(" ")
        .toLowerCase();
      return inCollection && (!q || haystack.includes(q));
    });
  }, [articles, filter, collectionFilter]);

  const reviewCounts = useMemo(() => {
    const count = (status: string) => articles.filter((a) => (a.screeningStatus || "unscreened") === status).length;
    return {
      total: articles.length,
      include: count("include"),
      exclude: count("exclude"),
      maybe: count("maybe"),
      unscreened: count("unscreened"),
    };
  }, [articles]);

  async function patchArticle(id: string, patch: Partial<Article>) {
    const response = await fetch("/api/library/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Update failed");
    setArticles((current) => current.map((article) => (articleId(article) === id ? { ...article, ...data.article } : article)));
  }

  async function askLibrary() {
    try {
      setAsking(true);
      setAnswer("");
      const response = await fetch("/api/ai/library-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, articleIds: Array.from(selectedForAi) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "AI request failed");
      setAnswer(data.answer || "");
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "تعذر تشغيل المساعد.", tone: "error" });
    } finally {
      setAsking(false);
    }
  }

  async function findJournals() {
    if (!journalQuery.trim()) return;
    try {
      setFindingJournals(true);
      const response = await fetch(`/api/journal-finder?q=${encodeURIComponent(journalQuery.trim())}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Journal search failed");
      setJournals(Array.isArray(data?.journals) ? data.journals : []);
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "تعذر البحث عن المجلات.", tone: "error" });
    } finally {
      setFindingJournals(false);
    }
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "library", label: "المكتبة المتقدمة" },
    { id: "searches", label: "البحوث المحفوظة والتنبيهات" },
    { id: "review", label: "المراجعة المنهجية" },
    { id: "assistant", label: "المساعد البحثي" },
    { id: "journals", label: "مرشد المجلات" },
  ];

  return (
    <div className="min-h-screen bg-[#f6f8fb]" dir="rtl">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-slate-950 p-6 text-white shadow-xl sm:p-9">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-black tracking-[0.14em] text-blue-300">RESEARCH WORKSPACE</p>
              <h1 className="mt-2 text-3xl font-black sm:text-4xl">مساحة العمل البحثية</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                إدارة المصادر، الفرز المنهجي، الملاحظات، التصدير، الاستفسار من مكتبتك فقط، واختيار مجلات مرشحة ضمن مسار واحد.
              </p>
            </div>
            <Link href="/search" className="rounded-xl bg-white px-5 py-3 text-sm font-black text-slate-950">إضافة مصادر</Link>
          </div>
        </section>

        <div className="mt-5 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-black ${tab === item.id ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-6 h-72 animate-pulse rounded-3xl border border-slate-200 bg-white" />
        ) : null}

        {!loading && tab === "library" ? (
          <section className="mt-6 space-y-5">
            <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[1fr_auto_auto]">
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="ابحث داخل مكتبتك..." className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500" />
              <select value={collectionFilter} onChange={(e) => setCollectionFilter(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold">
                {collections.map((item) => <option key={item}>{item}</option>)}
              </select>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => downloadText("researchranker.bib", bibtex(filtered))} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">BibTeX</button>
                <button onClick={() => downloadText("researchranker.ris", ris(filtered))} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">RIS</button>
                <button onClick={() => downloadText("researchranker-zotero.json", JSON.stringify(filtered, null, 2), "application/json")} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">Zotero JSON</button>
              </div>
            </div>

            {filtered.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">لا توجد مصادر مطابقة.</div> : null}

            <div className="grid gap-4 lg:grid-cols-2">
              {filtered.map((article) => {
                const id = articleId(article);
                return (
                  <article key={id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-blue-700">{clean(article.journal) || "مجلة غير محددة"}</p>
                        <h2 className="mt-2 text-lg font-black leading-7 text-slate-950">{clean(article.title) || "مصدر بلا عنوان"}</h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => patchArticle(id, { favorite: !article.favorite }).catch(() => setToast({ message: "تعذر تحديث المفضلة.", tone: "error" }))}
                        className={`grid h-10 w-10 place-items-center rounded-xl border text-lg ${article.favorite ? "border-amber-300 bg-amber-50 text-amber-600" : "border-slate-200 text-slate-400"}`}
                        aria-label="مفضلة"
                      >★</button>
                    </div>
                    <p className="mt-3 text-xs leading-6 text-slate-500">{clean(article.authors)}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <select value={article.readingStatus || "to-read"} onChange={(e) => patchArticle(id, { readingStatus: e.target.value as Article["readingStatus"] })} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-bold">
                        <option value="to-read">للقراءة</option><option value="reading">قيد القراءة</option><option value="read">تمت القراءة</option>
                      </select>
                      <input
                        defaultValue={clean(article.collection) || "Unsorted"}
                        onBlur={(e) => patchArticle(id, { collection: e.target.value })}
                        className="min-w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                        aria-label="المجموعة"
                      />
                    </div>
                    <input
                      defaultValue={(article.tags || []).join(", ")}
                      onBlur={(e) => patchArticle(id, { tags: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) })}
                      placeholder="وسوم مفصولة بفواصل"
                      className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                    />
                    <textarea
                      defaultValue={article.notes || ""}
                      onBlur={(e) => patchArticle(id, { notes: e.target.value })}
                      placeholder="ملاحظاتك على هذا المصدر..."
                      className="mt-3 min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm leading-6"
                    />
                    <div className="mt-4 flex flex-wrap gap-2">
                      {article.doi ? <Link href={`/article?doi=${encodeURIComponent(article.doi)}`} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white">تفاصيل المصدر</Link> : null}
                      {article.doi ? <Link href={`/graph?doi=${encodeURIComponent(article.doi)}`} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-black text-slate-700">خريطة العلاقات</Link> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {!loading && tab === "searches" ? (
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black text-slate-950">البحوث المحفوظة والتنبيهات</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">احفظ البحث من صفحة النتائج، ثم أعد تشغيله بنقرة واحدة. البنية جاهزة لإضافة تنبيهات دورية داخل المنصة دون إرسال نتائج غير موثقة.</p>
            <div className="mt-5 space-y-3">
              {searches.length === 0 ? <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">لا توجد بحوث محفوظة بعد.</p> : null}
              {searches.map((search) => (
                <div key={search.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div><h3 className="font-black text-slate-950">{search.query}</h3><p className="mt-1 text-xs text-slate-500">{search.quartile} • {search.field} • {search.alertEnabled ? "التنبيه مفعّل" : "التنبيه متوقف"}</p></div>
                  <div className="flex gap-2">
                    <Link href={`/results?q=${encodeURIComponent(search.query)}&quartile=${encodeURIComponent(search.quartile)}&field=${encodeURIComponent(search.field)}`} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white">تشغيل البحث</Link>
                    <button onClick={async () => { await fetch("/api/saved-searches", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: search.id }) }); setSearches((current) => current.filter((item) => item.id !== search.id)); }} className="rounded-xl border border-red-200 px-3 py-2 text-xs font-black text-red-600">حذف</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {!loading && tab === "review" ? (
          <section className="mt-6 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                ["الإجمالي", reviewCounts.total], ["مضمّن", reviewCounts.include], ["مستبعد", reviewCounts.exclude], ["ربما", reviewCounts.maybe], ["غير مفحوص", reviewCounts.unscreened],
              ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>)}
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black">فرز العناوين والملخصات</h2>
              <p className="mt-2 text-sm text-slate-600">هذه المرحلة تحفظ قرار Include / Exclude / Maybe وسبب الاستبعاد لكل مصدر، وتوفّر أساس حسابات PRISMA دون ادعاء أرقام غير موجودة.</p>
              <div className="mt-5 space-y-3">
                {articles.map((article) => {
                  const id = articleId(article);
                  return <div key={id} className="rounded-2xl border border-slate-200 p-4">
                    <h3 className="font-black leading-6">{article.title}</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(["include", "exclude", "maybe", "unscreened"] as const).map((status) => <button key={status} onClick={() => patchArticle(id, { screeningStatus: status })} className={`rounded-lg px-3 py-2 text-xs font-black ${article.screeningStatus === status || (!article.screeningStatus && status === "unscreened") ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}>{status}</button>)}
                    </div>
                    {(article.screeningStatus === "exclude") ? <input defaultValue={article.exclusionReason || ""} onBlur={(e) => patchArticle(id, { exclusionReason: e.target.value })} placeholder="سبب الاستبعاد" className="mt-3 w-full rounded-xl border border-red-200 px-3 py-2 text-sm" /> : null}
                  </div>;
                })}
              </div>
            </div>
          </section>
        ) : null}

        {!loading && tab === "assistant" ? (
          <section className="mt-6 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black">اختر المصادر</h2>
              <p className="mt-2 text-xs leading-6 text-slate-500">المساعد لا يستخدم معرفة خارج المصادر التي تختارها.</p>
              <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto">
                {articles.map((article) => {
                  const id = articleId(article);
                  return <label key={id} className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3 text-sm"><input type="checkbox" checked={selectedForAi.has(id)} onChange={(e) => setSelectedForAi((current) => { const next = new Set(current); e.target.checked ? next.add(id) : next.delete(id); return next; })} /><span className="font-bold leading-6">{article.title}</span></label>;
                })}
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black">مساعد بحثي موثّق بالمصادر</h2>
              <textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="مثال: ما أهم النتائج المشتركة والاختلافات بين هذه الدراسات؟" className="mt-4 min-h-28 w-full rounded-2xl border border-slate-300 p-4 text-sm leading-7" />
              <button disabled={asking || !question.trim() || selectedForAi.size === 0} onClick={askLibrary} className="mt-3 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{asking ? "جارٍ التحليل..." : "حلّل المصادر المحددة"}</button>
              {answer ? <div className="mt-5 whitespace-pre-wrap rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm leading-8 text-slate-800">{answer}</div> : null}
            </div>
          </section>
        ) : null}

        {!loading && tab === "journals" ? (
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black">مرشد المجلات</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">يعرض مجلات مرشحة من بيانات OpenAlex. لا يعرض APC أو زمن المراجعة على أنهما حقائق ما لم تتوفر لهما مصادر أولية موثوقة.</p>
            <div className="mt-5 flex gap-2"><input value={journalQuery} onChange={(e) => setJournalQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && findJournals()} placeholder="اكتب مجال البحث أو كلمات من عنوان الدراسة" className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm" /><button onClick={findJournals} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white">{findingJournals ? "بحث..." : "اقترح مجلات"}</button></div>
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {journals.map((journal, index) => <article key={String(journal.id || index)} className="rounded-2xl border border-slate-200 p-5"><h3 className="text-lg font-black">{String(journal.title || "")}</h3><p className="mt-2 text-xs text-slate-500">ISSN: {String(journal.issn || "غير متاح")} • H-index: {String(journal.hIndex ?? "غير متاح")}</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{journal.isOpenAccess ? "وصول مفتوح" : "ليس OA بالكامل"}</span>{journal.inDoaj ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">DOAJ</span> : null}</div><p className="mt-3 text-xs leading-6 text-amber-800">{String(journal.caveat || "")}</p></article>)}
            </div>
          </section>
        ) : null}
      </main>
      {toast ? <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} /> : null}
    </div>
  );
}
