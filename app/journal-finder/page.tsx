"use client";

import { useState } from "react";
import AppHeader from "@/components/layout/AppHeader";

type Candidate = {
  name: string;
  articles: number;
  verifiedArticles: number;
  quartile: string;
  publisher: string;
  issn: string;
  sjr: string;
  hIndex: string;
  indexingStatus: string;
  matchConfidence: string;
  score: number;
  evidence: string;
  openAccess: null;
  apc: null;
  reviewTime: null;
  caveat: string;
};

export default function JournalFinderPage() {
  const [manuscript, setManuscript] = useState("");
  const [quartile, setQuartile] = useState("All");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function find() {
    if (!manuscript.trim()) return;
    setLoading(true);
    setMessage("");
    setCandidates([]);
    try {
      const response = await fetch("/api/journal-finder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manuscript, quartile }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "تعذر اقتراح المجلات.");
      setCandidates(Array.isArray(data.candidates) ? data.candidates : []);
      if (!data.candidates?.length) setMessage("لم نجد مرشحين موثوقين كفاية. جرّب عنوانًا وملخصًا أو كلمات مفتاحية أكثر تحديدًا.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر اقتراح المجلات.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb]" dir="rtl">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-[30px] bg-slate-950 p-7 text-white shadow-xl sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-300">Journal Finder</p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">اختر وجهة نشر مبنية على أدلة مرتبطة بموضوعك.</h1>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">نبحث عن المجلات التي نشرت أوراقًا قريبة من مخطوطتك، ثم نرتبها باستخدام تكرار الصلة وحالة التحقق من بيانات المجلة. لا نعرض APC أو review time كحقيقة إذا لم يتوفر مصدر موثوق.</p>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
            <label className="text-sm font-black text-slate-800">عنوان البحث + الملخص أو الكلمات المفتاحية
              <textarea value={manuscript} onChange={(event) => setManuscript(event.target.value)} rows={8} placeholder="Paste manuscript title, abstract, and key terms..." className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 p-4 text-sm leading-7 outline-none focus:border-blue-500 focus:bg-white" />
            </label>
            <div><label className="text-sm font-black text-slate-800">الربع المستهدف<select value={quartile} onChange={(event) => setQuartile(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold"><option value="All">أي ربع</option><option value="Q1">Q1</option><option value="Q2">Q2</option><option value="Q3">Q3</option><option value="Q4">Q4</option></select></label><button onClick={find} disabled={loading || !manuscript.trim()} className="mt-4 w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white disabled:opacity-40">{loading ? "جاري تحليل المجال..." : "ابحث عن مجلات مناسبة"}</button><p className="mt-4 text-xs leading-6 text-slate-500">النتيجة recommendation وليست ضمان قبول. Scope الرسمي للمجلة وسياسة الناشر يجب مراجعتهما قبل الإرسال.</p></div>
          </div>
          {message ? <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">{message}</p> : null}
        </section>

        {candidates.length ? <section className="mt-6"><div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-black uppercase tracking-wider text-fuchsia-700">Ranked candidates</p><h2 className="mt-1 text-2xl font-black text-slate-950">المجلات المرشحة</h2></div><span className="text-xs font-bold text-slate-500">مرتبة حسب evidence score</span></div><div className="grid gap-4 lg:grid-cols-2">{candidates.map((candidate, index) => <article key={candidate.name} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-wider text-fuchsia-700">#{index + 1} • Match score {candidate.score}%</p><h3 className="mt-2 text-xl font-black leading-7 text-slate-950">{candidate.name}</h3><p className="mt-1 text-xs text-slate-500">{candidate.publisher || "Publisher not verified"}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-black ${candidate.quartile === "Q1" ? "bg-emerald-50 text-emerald-700" : candidate.quartile === "Q2" ? "bg-blue-50 text-blue-700" : candidate.quartile === "Q3" ? "bg-amber-50 text-amber-700" : candidate.quartile === "Q4" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>{candidate.quartile}</span></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><Mini label="Relevant papers" value={candidate.articles} /><Mini label="Verified matches" value={candidate.verifiedArticles} /><Mini label="SJR" value={candidate.sjr || "—"} /><Mini label="H-index" value={candidate.hIndex || "—"} /></div><p className="mt-4 rounded-2xl bg-slate-50 p-3 text-xs leading-6 text-slate-700">{candidate.evidence}</p><dl className="mt-4 space-y-2 text-xs"><Row label="ISSN" value={candidate.issn || "Not verified"} /><Row label="Indexing" value={candidate.indexingStatus || "Unknown"} /><Row label="APC" value="Not shown without verified source" /><Row label="Review time" value="Not shown without verified source" /></dl><p className="mt-4 text-[10px] leading-5 text-slate-500">{candidate.caveat}</p></article>)}</div></section> : null}
      </main>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-[9px] font-bold text-slate-500">{label}</p><p className="mt-1 text-sm font-black text-slate-950">{value}</p></div>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4 border-b border-slate-100 pb-2"><dt className="font-bold text-slate-500">{label}</dt><dd className="text-left font-semibold text-slate-900">{value}</dd></div>; }
