"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type VerificationResult = {
  query: { issn: string; title: string };
  journal: {
    title: string;
    publisher: string;
    issn: string;
    eIssn: string;
    sourceId: string;
  };
  indexing: {
    scopus: "verified" | "not_checked" | "not_found" | "unavailable";
    clarivate: "not_checked" | "configured" | "unavailable";
  };
  metrics: {
    quartile: "Q1" | "Q2" | "Q3" | "Q4" | null;
    sjr: string;
    snip: string;
    hIndex: string;
  };
  evidence: Array<{
    source: string;
    level: "direct" | "snapshot" | "metadata";
    matchedBy: "issn" | "title" | "none";
    note: string;
    sourceUrl?: string;
  }>;
  confidence: "direct+snapshot" | "direct" | "snapshot" | "metadata-only" | "unverified";
  limitations: string[];
};

function statusLabel(status: VerificationResult["indexing"]["scopus"]) {
  if (status === "verified") return "مؤكد عبر Scopus API";
  if (status === "not_found") return "لم يُعثر عليه في الطلب المباشر";
  if (status === "unavailable") return "تعذر الاتصال أو لا توجد صلاحية";
  return "لم يُفحص مباشرة";
}

function confidenceLabel(value: VerificationResult["confidence"]) {
  const labels: Record<VerificationResult["confidence"], string> = {
    "direct+snapshot": "تحقق مباشر + مطابقة Snapshot",
    direct: "تحقق مباشر",
    snapshot: "مطابقة ISSN في Snapshot",
    "metadata-only": "بيانات وصفية فقط",
    unverified: "غير متحقق",
  };
  return labels[value];
}

export default function JournalSlider() {
  const [issn, setIssn] = useState("");
  const [title, setTitle] = useState("");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!issn.trim() && !title.trim()) return;

    try {
      setLoading(true);
      setError("");
      setResult(null);

      const params = new URLSearchParams();
      if (issn.trim()) params.set("issn", issn.trim());
      if (title.trim()) params.set("title", title.trim());

      const response = await fetch(`/api/journal-verify?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Journal verification failed.");
      }

      setResult(data as VerificationResult);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "فشل التحقق من المجلة.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 sm:px-6 sm:py-8" dir="rtl">
      <section className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Journal Intelligence</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">التحقق من المجلات والتصنيف</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              أدخل ISSN للحصول على أقوى مطابقة ممكنة. النظام لا يمنح Q اعتماداً على تشابه الاسم فقط، ويعرض مصدر الدليل وحدود التحقق بوضوح.
            </p>
          </div>

          <div className="flex gap-2">
            <Link href="/search" className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700">البحث الأكاديمي</Link>
            <Link href="/dashboard" className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">لوحة التحكم</Link>
          </div>
        </header>

        <section className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white shadow-xl sm:p-7">
          <form onSubmit={verify} className="grid gap-4 lg:grid-cols-[.7fr_1.3fr_auto] lg:items-end">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">ISSN / eISSN</span>
              <input
                value={issn}
                onChange={(event) => setIssn(event.target.value)}
                placeholder="مثال: 0308-8146"
                inputMode="text"
                className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-blue-400"
              />
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">اسم المجلة - اختياري</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Journal title"
                className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-blue-400"
              />
            </label>

            <button
              type="submit"
              disabled={loading || (!issn.trim() && !title.trim())}
              className="min-h-12 rounded-xl bg-blue-600 px-6 text-sm font-black text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? "جاري التحقق..." : "تحقق الآن"}
            </button>
          </form>

          <p className="mt-4 text-xs leading-6 text-slate-400">
            للأمان العلمي: المطابقة بالاسم وحده تستخدم للتعرف على البيانات فقط. اعتماد الربع يحتاج ISSN مطابقاً ومصدر بيانات مناسباً.
          </p>
        </section>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error}</div>
        ) : null}

        {result ? (
          <div className="mt-5 space-y-5">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-black text-slate-400">الربع</p>
                <p className="mt-2 text-3xl font-black text-slate-950">{result.metrics.quartile || "غير مؤكد"}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">{result.metrics.quartile ? "من Snapshot مطابق بـISSN" : "لا يوجد دليل كافٍ لعرض Q"}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-black text-slate-400">Scopus</p>
                <p className="mt-2 text-lg font-black text-slate-950">{statusLabel(result.indexing.scopus)}</p>
                <p className="mt-2 text-xs text-slate-500">Source ID: {result.journal.sourceId || "—"}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-black text-slate-400">SJR / SNIP</p>
                <p className="mt-2 text-lg font-black text-slate-950">{result.metrics.sjr || "—"} / {result.metrics.snip || "—"}</p>
                <p className="mt-2 text-xs text-slate-500">H-index: {result.metrics.hIndex || "—"}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-black text-slate-400">مستوى الثقة</p>
                <p className="mt-2 text-lg font-black text-slate-950">{confidenceLabel(result.confidence)}</p>
                <p className="mt-2 text-xs text-slate-500">لا يتحول إلى “مؤكد” عند غياب الدليل.</p>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-blue-700">Journal identity</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">{result.journal.title || result.query.title || "مجلة غير معروفة"}</h2>
                  <dl className="mt-5 space-y-3 text-sm">
                    <div className="flex justify-between gap-4 border-b border-slate-100 pb-3"><dt className="font-bold text-slate-500">الناشر</dt><dd className="text-left font-black text-slate-900">{result.journal.publisher || "—"}</dd></div>
                    <div className="flex justify-between gap-4 border-b border-slate-100 pb-3"><dt className="font-bold text-slate-500">ISSN</dt><dd className="font-black text-slate-900">{result.journal.issn || "—"}</dd></div>
                    <div className="flex justify-between gap-4 border-b border-slate-100 pb-3"><dt className="font-bold text-slate-500">eISSN</dt><dd className="font-black text-slate-900">{result.journal.eIssn || "—"}</dd></div>
                  </dl>
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-emerald-700">Evidence trail</p>
                  <div className="mt-3 space-y-3">
                    {result.evidence.length ? result.evidence.map((item, index) => (
                      <div key={`${item.source}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-black text-slate-950">{item.source}</p>
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-600">{item.level} • {item.matchedBy}</span>
                        </div>
                        <p className="mt-2 text-sm leading-7 text-slate-600">{item.note}</p>
                        {item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex text-sm font-black text-blue-700 hover:underline">فتح المصدر الأصلي</a> : null}
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">لا يوجد دليل موثوق كافٍ لهذه المجلة حالياً.</div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {result.limitations.length ? (
              <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 sm:p-7">
                <h2 className="font-black text-amber-950">قيود التحقق الحالية</h2>
                <ul className="mt-3 space-y-2 text-sm leading-7 text-amber-900">
                  {result.limitations.map((item) => <li key={item}>• {item}</li>)}
                </ul>
              </section>
            ) : null}
          </div>
        ) : (
          <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {["Q1", "Q2", "Q3", "Q4"].map((quartile) => (
              <div key={quartile} className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                <p className="text-2xl font-black text-slate-950">{quartile}</p>
                <p className="mt-2 text-xs leading-6 text-slate-500">يظهر فقط عندما توجد مطابقة آمنة للهوية ومصدر تصنيف واضح.</p>
              </div>
            ))}
          </section>
        )}
      </section>
    </main>
  );
}
