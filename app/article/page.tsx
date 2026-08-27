"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";

type DetailData = {
  article?: {
    doi?: string;
    title?: string;
    abstract?: string;
    authors?: string;
    journal?: string;
    publisher?: string;
    year?: string;
    type?: string;
    issn?: string[];
    citedByCount?: number | null;
    isOpenAccess?: boolean;
    oaStatus?: string;
    oaUrl?: string;
    primaryUrl?: string;
    isRetracted?: boolean;
    quartile?: string;
    sjr?: string;
    hIndex?: string;
    indexingStatus?: string;
    matchConfidence?: string;
  };
  relations?: Array<{ relation?: string; id?: string; idType?: string; assertedBy?: string }>;
  trustSignals?: Array<{
    level?: "critical" | "attention" | "info" | string;
    label?: string;
    detail?: string;
    source?: string;
  }>;
  checkedAt?: string;
  provenance?: Record<string, string>;
};

type AiSummary = {
  objective?: string;
  methodology?: string;
  keyFindings?: string[];
  conclusion?: string;
  researchValue?: string;
  limitationNote?: string;
};

export default function ArticlePage() {
  const [doi, setDoi] = useState("");
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<AiSummary | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("doi") || "";
    setDoi(value);
    if (!value) {
      setError("لم يتم تحديد DOI للمصدر.");
      setLoading(false);
      return;
    }

    fetch(`/api/article?doi=${encodeURIComponent(value)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error || "تعذر تحميل المصدر.");
        setData(body);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "تعذر تحميل المصدر.")
      )
      .finally(() => setLoading(false));
  }, []);

  async function summarize() {
    if (!data?.article) return;
    try {
      setSummarizing(true);
      const response = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.article.title,
          journal: data.article.journal,
          authors: data.article.authors,
          pubdate: data.article.year,
          abstract: data.article.abstract,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || "AI summary failed");
      setSummary(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إنشاء الملخص.");
    } finally {
      setSummarizing(false);
    }
  }

  const article = data?.article;

  return (
    <div className="min-h-screen bg-[#f6f8fb]" dir="rtl">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8">
        {loading ? (
          <div className="h-80 animate-pulse rounded-3xl border border-slate-200 bg-white" />
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        {!loading && article ? (
          <>
            {article.isRetracted ? (
              <section className="mb-5 rounded-3xl border-2 border-red-300 bg-red-50 p-5 shadow-sm">
                <p className="text-xs font-black text-red-700">تنبيه عالي الأهمية</p>
                <h2 className="mt-1 text-xl font-black text-red-950">
                  OpenAlex يعلّم هذا العمل على أنه مسحوب (Retracted)
                </h2>
                <p className="mt-2 text-sm leading-7 text-red-800">
                  لا تعتمد على نتائجه قبل مراجعة إشعار السحب وسجل الناشر. هذا
                  التنبيه يعكس بيانات OpenAlex الحالية ولا يستبدل التحقق من المصدر
                  الأولي.
                </p>
              </section>
            ) : null}

            <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
              <div className="bg-slate-950 px-6 py-8 text-white sm:px-9">
                <p className="text-xs font-black tracking-[0.14em] text-blue-300">
                  صفحة أدلة المصدر
                </p>
                <h1 className="mt-3 max-w-4xl text-2xl font-black leading-10 sm:text-3xl">
                  {article.title || "مصدر بلا عنوان"}
                </h1>
                <p className="mt-4 text-sm leading-7 text-slate-300">
                  {article.authors}
                </p>
                <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold">
                  {article.journal ? (
                    <span className="rounded-full bg-white/10 px-3 py-1.5">
                      {article.journal}
                    </span>
                  ) : null}
                  {article.year ? (
                    <span className="rounded-full bg-white/10 px-3 py-1.5">
                      {article.year}
                    </span>
                  ) : null}
                  {article.doi ? (
                    <span className="rounded-full bg-white/10 px-3 py-1.5">
                      DOI: {article.doi}
                    </span>
                  ) : null}
                  {article.quartile ? (
                    <span className="rounded-full bg-blue-500/20 px-3 py-1.5 text-blue-100">
                      {article.quartile} • محفوظ من تحقق ResearchRanker
                    </span>
                  ) : null}
                  <span
                    className={`rounded-full px-3 py-1.5 ${
                      article.isOpenAccess
                        ? "bg-emerald-500/20 text-emerald-100"
                        : "bg-white/10"
                    }`}
                  >
                    {article.isOpenAccess
                      ? "وصول مفتوح"
                      : "الوصول المفتوح غير مؤكد"}
                  </span>
                </div>
              </div>
              <div className="grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                <Metric
                  label="الاستشهادات"
                  value={article.citedByCount ?? "غير متاح"}
                />
                <Metric label="الربع" value={article.quartile || "غير متاح"} />
                <Metric label="SJR" value={article.sjr || "غير متاح"} />
                <Metric label="H-index" value={article.hIndex || "غير متاح"} />
                <Metric label="الناشر" value={article.publisher || "غير متاح"} />
                <Metric label="نوع العمل" value={article.type || "غير متاح"} />
                <Metric label="حالة OA" value={article.oaStatus || "غير متاح"} />
              </div>
            </section>

            <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black text-blue-700">الملخص</p>
                    <h2 className="mt-1 text-2xl font-black">محتوى المصدر</h2>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={summarize}
                      disabled={summarizing || !article.abstract}
                      className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
                    >
                      {summarizing
                        ? "جارٍ التلخيص..."
                        : "تلخيص بالذكاء الاصطناعي"}
                    </button>
                    <Link
                      href={`/graph?doi=${encodeURIComponent(doi)}`}
                      className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-black text-slate-700"
                    >
                      خريطة العلاقات
                    </Link>
                  </div>
                </div>
                <p className="mt-5 whitespace-pre-wrap text-sm leading-8 text-slate-700">
                  {article.abstract || "لا يتوفر ملخص من المصدر الحالي."}
                </p>
                {summary ? (
                  <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
                    <h3 className="font-black text-slate-950">ملخص بحثي آلي</h3>
                    <div className="mt-3 space-y-3 text-sm leading-7 text-slate-700">
                      <p>
                        <strong>الهدف:</strong> {summary.objective}
                      </p>
                      <p>
                        <strong>المنهجية:</strong> {summary.methodology}
                      </p>
                      <div>
                        <strong>أهم النتائج:</strong>
                        <ul className="mt-1 list-disc space-y-1 pr-5">
                          {(summary.keyFindings || []).map((item, index) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <p>
                        <strong>الخلاصة:</strong> {summary.conclusion}
                      </p>
                      <p>
                        <strong>القيمة البحثية:</strong> {summary.researchValue}
                      </p>
                      <p className="rounded-xl bg-white p-3 text-xs text-slate-500">
                        {summary.limitationNote}
                      </p>
                    </div>
                  </div>
                ) : null}
              </section>

              <aside className="space-y-5">
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-black">طبقة الثقة والتحقق</h2>
                  <p className="mt-2 text-xs leading-6 text-slate-500">
                    كل إشارة مرتبطة بمصدر بيانات محدد؛ لا تمثل حكمًا آليًا على جودة
                    الدراسة.
                  </p>
                  <div className="mt-4 space-y-3">
                    {(data?.trustSignals || []).map((signal, index) => {
                      const classes =
                        signal.level === "critical"
                          ? "border-red-300 bg-red-50"
                          : signal.level === "attention"
                            ? "border-amber-200 bg-amber-50"
                            : "border-slate-200 bg-slate-50";
                      return (
                        <div key={index} className={`rounded-2xl border p-4 ${classes}`}>
                          <p className="text-sm font-black text-slate-900">
                            {signal.label}
                          </p>
                          <p className="mt-1 text-xs leading-6 text-slate-600">
                            {signal.detail}
                          </p>
                          <p className="mt-2 text-[11px] font-black text-blue-700">
                            المصدر: {signal.source}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-4 text-[11px] text-slate-400">
                    آخر تحقق:{" "}
                    {data?.checkedAt
                      ? new Date(data.checkedAt).toLocaleString("ar-IQ")
                      : "غير متاح"}
                  </p>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-black">بيانات التصنيف المحفوظة</h2>
                  <div className="mt-4 space-y-2 text-xs leading-6 text-slate-600">
                    <p>
                      <strong>حالة الفهرسة:</strong>{" "}
                      {article.indexingStatus || "غير متاحة"}
                    </p>
                    <p>
                      <strong>دليل المطابقة:</strong>{" "}
                      {article.matchConfidence || "غير متاح"}
                    </p>
                    <p className="rounded-xl bg-slate-50 p-3 text-[11px]">
                      هذه البيانات تظهر فقط عندما وُجدت سابقًا في مكتبتك نتيجة تحقق
                      محفوظة. عدم ظهورها لا يعني أن المجلة غير مفهرسة.
                    </p>
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-black">الوصول والروابط</h2>
                  <div className="mt-4 space-y-2">
                    {article.oaUrl ? (
                      <a
                        href={article.oaUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-black text-white"
                      >
                        فتح نسخة الوصول المفتوح
                      </a>
                    ) : null}
                    {article.primaryUrl ? (
                      <a
                        href={article.primaryUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-black text-slate-700"
                      >
                        فتح صفحة الناشر
                      </a>
                    ) : null}
                    {article.doi ? (
                      <a
                        href={`https://doi.org/${article.doi}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-black text-slate-700"
                      >
                        فتح DOI
                      </a>
                    ) : null}
                  </div>
                </section>

                {(data?.relations || []).length ? (
                  <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
                    <h2 className="text-lg font-black text-amber-950">
                      علاقات تحديث/تصحيح
                    </h2>
                    <div className="mt-3 space-y-2 text-xs text-amber-900">
                      {(data?.relations || []).map((relation, index) => (
                        <p key={index}>
                          <strong>{relation.relation}</strong>: {relation.id} ({relation.idType})
                        </p>
                      ))}
                    </div>
                  </section>
                ) : null}
              </aside>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 bg-white px-4 py-4">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}
