"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import type { LibraryArticle, ScreeningStatus } from "@/lib/research-types";

function clean(value: unknown) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function idOf(article: LibraryArticle) { return clean(article.id || article.doi || article.pmid || article.title); }
function canonical(article: LibraryArticle) { return clean(article.doi || article.pmid || article.title).toLowerCase().replace(/[^a-z0-9\p{L}\p{N}]+/gu, ""); }

export default function ReviewPage() {
  const [articles, setArticles] = useState<LibraryArticle[]>([]);
  const [filter, setFilter] = useState<"all" | ScreeningStatus>("all");
  const [active, setActive] = useState<LibraryArticle | null>(null);
  const [reason, setReason] = useState("");
  const [extraction, setExtraction] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/library/list", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setArticles(Array.isArray(data.articles) ? data.articles : []);
    else setMessage(data?.error || "تعذر تحميل المكتبة.");
  }

  useEffect(() => { load(); }, []);

  const duplicates = useMemo(() => {
    const seen = new Map<string, string>();
    const duplicateIds = new Set<string>();
    for (const article of articles) {
      const key = canonical(article);
      const id = idOf(article);
      if (!key || !id) continue;
      if (seen.has(key)) { duplicateIds.add(id); duplicateIds.add(seen.get(key)!); }
      else seen.set(key, id);
    }
    return duplicateIds;
  }, [articles]);

  const counts = useMemo(() => ({
    total: articles.length,
    duplicates: duplicates.size,
    unscreened: articles.filter((a) => (a.screeningStatus || "unscreened") === "unscreened").length,
    include: articles.filter((a) => a.screeningStatus === "include").length,
    maybe: articles.filter((a) => a.screeningStatus === "maybe").length,
    exclude: articles.filter((a) => a.screeningStatus === "exclude").length,
  }), [articles, duplicates]);

  const visible = useMemo(() => articles.filter((article) => filter === "all" || (article.screeningStatus || "unscreened") === filter), [articles, filter]);

  async function setDecision(article: LibraryArticle, decision: ScreeningStatus) {
    const response = await fetch("/api/library/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: idOf(article), screeningStatus: decision, screeningReason: decision === "exclude" ? reason : clean(article.screeningReason) }),
    });
    const data = await response.json();
    if (response.ok) {
      setArticles((current) => current.map((item) => idOf(item) === idOf(article) ? data.article : item));
      setActive(data.article);
      setReason(clean(data.article.screeningReason));
      setMessage(`تم تسجيل القرار: ${decision}.`);
    } else setMessage(data?.error || "تعذر حفظ القرار.");
  }

  async function saveExtraction() {
    if (!active) return;
    const response = await fetch("/api/library/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: idOf(active), extraction }),
    });
    const data = await response.json();
    if (response.ok) {
      setArticles((current) => current.map((item) => idOf(item) === idOf(active) ? data.article : item));
      setActive(data.article);
      setMessage("تم حفظ جدول استخراج البيانات لهذه الورقة.");
    } else setMessage(data?.error || "تعذر حفظ الاستخراج.");
  }

  function openArticle(article: LibraryArticle) {
    setActive(article);
    setReason(clean(article.screeningReason));
    setExtraction(article.extraction || {});
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb]" dir="rtl">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-[30px] bg-slate-950 p-7 text-white shadow-xl sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Systematic Review Workspace</p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">Screening وPRISMA واستخراج البيانات في مساحة واحدة.</h1>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">يعتمد هذا القسم على المصادر المحفوظة في مكتبتك. القرارات قابلة للتتبع، مع سبب الاستبعاد، كشف أولي للتكرار، وفرز Include / Exclude / Maybe.</p>
        </section>

        <section className="mt-6 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Records" value={counts.total} /><Stat label="Potential duplicates" value={counts.duplicates} /><Stat label="Unscreened" value={counts.unscreened} /><Stat label="Include" value={counts.include} /><Stat label="Maybe" value={counts.maybe} /><Stat label="Exclude" value={counts.exclude} />
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1fr]">
            <Flow label="Identified" value={counts.total} /><Flow label="After duplicate flagging" value={Math.max(0, counts.total - Math.floor(counts.duplicates / 2))} /><Flow label="Screened" value={counts.total - counts.unscreened} /><Flow label="Included" value={counts.include} />
          </div>
          <p className="mt-4 text-xs leading-6 text-slate-500">PRISMA preview: الأرقام مشتقة من مكتبتك وقرارات screening الحالية. كشف التكرار هنا conservative ويعتمد DOI/PMID/العنوان؛ قبل النشر يجب مراجعة التكرارات يدويًا.</p>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-black">قائمة الفحص</h2><select value={filter} onChange={(event) => setFilter(event.target.value as "all" | ScreeningStatus)} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"><option value="all">كل السجلات</option><option value="unscreened">Unscreened</option><option value="include">Include</option><option value="maybe">Maybe</option><option value="exclude">Exclude</option></select></div>
            <div className="mt-4 max-h-[760px] space-y-3 overflow-y-auto pr-1">
              {visible.map((article) => {
                const id = idOf(article);
                const decision = article.screeningStatus || "unscreened";
                return <button key={id} onClick={() => openArticle(article)} className={`w-full rounded-2xl border p-4 text-right transition ${active && idOf(active) === id ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black text-blue-700">{article.journal} • {article.pubdate}</p><h3 className="mt-1 line-clamp-3 text-sm font-black leading-6 text-slate-950">{article.title}</h3></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${decision === "include" ? "bg-emerald-50 text-emerald-700" : decision === "exclude" ? "bg-red-50 text-red-700" : decision === "maybe" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{decision}</span></div>{duplicates.has(id) ? <p className="mt-2 text-[10px] font-black text-red-600">⚠ Potential duplicate</p> : null}</button>;
              })}
              {visible.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">لا توجد سجلات في هذا الفلتر.</div> : null}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            {!active ? <div className="grid min-h-[420px] place-items-center text-center"><div><h2 className="text-xl font-black">اختر ورقة لبدء screening</h2><p className="mt-2 text-sm text-slate-500">يمكنك لاحقًا استخدام هذه القرارات في PRISMA ومرحلة full-text screening.</p></div></div> : <>
              <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">Screening record</p>
              <h2 className="mt-2 text-xl font-black leading-8 text-slate-950">{active.title}</h2>
              <p className="mt-2 text-xs leading-6 text-slate-500">{active.authors} • {active.journal} • {active.pubdate}</p>
              <div className="mt-5 rounded-2xl bg-slate-50 p-4"><p className="max-h-48 overflow-y-auto text-xs leading-7 text-slate-700">{active.abstract || "Abstract unavailable."}</p></div>

              <div className="mt-5 grid gap-2 sm:grid-cols-3"><button onClick={() => setDecision(active, "include")} className="rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white">Include</button><button onClick={() => setDecision(active, "maybe")} className="rounded-xl bg-amber-500 px-4 py-3 text-xs font-black text-white">Maybe</button><button onClick={() => setDecision(active, "exclude")} className="rounded-xl bg-red-600 px-4 py-3 text-xs font-black text-white">Exclude</button></div>

              <label className="mt-4 block text-xs font-bold text-slate-600">سبب الاستبعاد / ملاحظة screening<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" placeholder="مثال: population غير مطابق، نوع دراسة غير مؤهل..." /></label>

              <div className="mt-6 border-t border-slate-100 pt-5"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-wider text-violet-700">Data extraction</p><h3 className="mt-1 text-lg font-black">جدول استخراج البيانات</h3></div><button onClick={saveExtraction} className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white">حفظ الاستخراج</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Population" value={extraction.population || ""} onChange={(value) => setExtraction((current) => ({ ...current, population: value }))} /><Field label="Study design" value={extraction.studyDesign || ""} onChange={(value) => setExtraction((current) => ({ ...current, studyDesign: value }))} /><Field label="Sample size" value={extraction.sampleSize || ""} onChange={(value) => setExtraction((current) => ({ ...current, sampleSize: value }))} /><Field label="Exposure / Intervention" value={extraction.exposure || ""} onChange={(value) => setExtraction((current) => ({ ...current, exposure: value }))} /><Field label="Comparator" value={extraction.comparator || ""} onChange={(value) => setExtraction((current) => ({ ...current, comparator: value }))} /><Field label="Key outcome" value={extraction.outcome || ""} onChange={(value) => setExtraction((current) => ({ ...current, outcome: value }))} /></div></div>

              <div className="mt-5 flex flex-wrap gap-2">{active.doi ? <Link href={`/article?doi=${encodeURIComponent(active.doi)}&id=${encodeURIComponent(idOf(active))}`} className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-black">تفاصيل الورقة</Link> : null}<Link href="/library" className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-black">المكتبة</Link></div>
              {message ? <p className="mt-4 rounded-xl bg-blue-50 p-3 text-xs font-semibold text-blue-800">{message}</p> : null}
            </>}
          </section>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[10px] font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-slate-950">{value}</p></div>; }
function Flow({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl bg-slate-50 p-4 text-center"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-blue-700">{value}</p></div>; }
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="text-xs font-bold text-slate-600">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal" /></label>; }
