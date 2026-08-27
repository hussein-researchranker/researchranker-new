"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import type { LibraryArticle } from "@/lib/research-types";

type AssistantResponse = {
  answer: string;
  evidenceGaps: string[];
  sourceIdsUsed: string[];
  sources: Array<{ marker: string; id?: string; title?: string; doi?: string; journal?: string }>;
  grounding: string;
};

function clean(value: unknown) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function idOf(article: LibraryArticle) { return clean(article.id || article.doi || article.pmid || article.title); }

export default function AssistantPage() {
  const [articles, setArticles] = useState<LibraryArticle[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AssistantResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/library/list", { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (response.ok) setArticles(Array.isArray(data.articles) ? data.articles : []);
      else setMessage(data?.error || "تعذر تحميل المكتبة.");
    });
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter((article) => [article.title, article.authors, article.journal, article.doi].map(clean).join(" ").toLowerCase().includes(q));
  }, [articles, query]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < 15) next.add(id);
      return next;
    });
  }

  async function ask() {
    if (!question.trim() || selected.size === 0) return;
    setLoading(true);
    setResult(null);
    setMessage("");
    try {
      const response = await fetch("/api/ai/library-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, articleIds: Array.from(selected) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "تعذر تشغيل المساعد.");
      setResult(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تشغيل المساعد.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb]" dir="rtl">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-[30px] bg-slate-950 p-7 text-white shadow-xl sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Grounded AI Research Assistant</p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">اسأل مكتبتك، وليس الإنترنت كله.</h1>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">الإجابة تُبنى حصراً من المصادر التي تختارها، مع علامات [S1] و[S2] لكل claim. إذا لم تكفِ الأدلة، يجب أن يذكر النظام ذلك صراحة.</p>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-slate-500">Sources</p><h2 className="mt-1 text-lg font-black">اختر حتى 15 دراسة</h2></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{selected.size}/15</span></div>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث داخل مكتبتك..." className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-500" />
            <div className="mt-4 max-h-[660px] space-y-2 overflow-y-auto pr-1">
              {visible.map((article) => { const id = idOf(article); const checked = selected.has(id); return <label key={id} className={`flex cursor-pointer gap-3 rounded-2xl border p-3 ${checked ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"}`}><input type="checkbox" checked={checked} onChange={() => toggle(id)} className="mt-1" /><div><p className="text-[10px] font-black text-blue-700">{article.journal} • {article.pubdate}</p><h3 className="mt-1 line-clamp-2 text-xs font-black leading-5 text-slate-950">{article.title}</h3>{!article.abstract ? <p className="mt-1 text-[10px] font-bold text-amber-700">Abstract غير متاح؛ قدرة الاستدلال محدودة.</p> : null}</div></label>; })}
              {articles.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">احفظ مصادر في المكتبة أولاً.</div> : null}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wider text-cyan-700">Research question</p>
            <textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={5} placeholder="مثال: ما الأدلة التي تدعم ارتباط zonulin بالالتهاب لدى مرضى الغسيل الكلوي؟ وما نقاط التعارض بين الدراسات؟" className="mt-3 w-full rounded-2xl border border-slate-300 bg-slate-50 p-4 text-sm leading-7 outline-none focus:border-blue-500 focus:bg-white" />
            <div className="mt-3 flex flex-wrap gap-2"><button onClick={ask} disabled={loading || !question.trim() || selected.size === 0} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white disabled:opacity-40">{loading ? "جاري تحليل الأدلة..." : "تحليل المصادر المختارة"}</button><button onClick={() => { setSelected(new Set(articles.filter((article) => article.abstract).slice(0, 15).map(idOf)); }} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs font-black">اختيار أول 15 مصدر بملخص</button></div>
            {message ? <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">{message}</p> : null}

            {!result ? <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center"><h2 className="text-lg font-black text-slate-900">الإجابة ستظهر هنا</h2><p className="mt-2 text-xs leading-6 text-slate-500">الهدف هو synthesis مدعوم بالمصادر وليس محادثة عامة.</p></div> : <div className="mt-6">
              <div className="rounded-3xl border border-blue-200 bg-blue-50/60 p-5"><div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-wider text-blue-700">Grounded synthesis</p><span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-emerald-700">Library-only</span></div><p className="mt-4 whitespace-pre-wrap text-sm leading-8 text-slate-800">{result.answer}</p></div>
              {result.evidenceGaps?.length ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><h3 className="text-sm font-black text-amber-900">Evidence gaps / limitations</h3><ul className="mt-2 space-y-2 text-xs leading-6 text-amber-900">{result.evidenceGaps.map((gap) => <li key={gap}>• {gap}</li>)}</ul></div> : null}
              <div className="mt-5"><h3 className="text-sm font-black text-slate-950">المصادر المشار إليها</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{result.sources?.map((source) => <article key={source.marker} className="rounded-2xl border border-slate-200 p-3"><p className="text-[10px] font-black text-blue-700">[{source.marker}] {source.journal}</p><p className="mt-1 line-clamp-2 text-xs font-black leading-5 text-slate-900">{source.title}</p>{source.doi ? <Link href={`/article?doi=${encodeURIComponent(source.doi)}`} className="mt-2 inline-flex text-[10px] font-black text-blue-700">فتح الورقة ←</Link> : null}</article>)}</div></div>
            </div>}
          </section>
        </div>
      </main>
    </div>
  );
}
