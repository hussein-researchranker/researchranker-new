"use client";

import { useEffect, useMemo, useState } from "react";
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
  screeningStatus?: "include" | "exclude" | "maybe" | "unscreened";
  exclusionReason?: string;
  fullTextStatus?: "pending" | "retrieved" | "unavailable" | "not-needed";
  duplicateOf?: string;
  extraction?: Record<string, string>;
};

type ToastState = { message: string; tone: "success" | "error" | "info" };

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function idOf(article: Article) {
  return clean(article.id || article.doi || article.pmid || article.title);
}

function normalizedTitle(value: unknown) {
  return clean(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function duplicateGroups(articles: Article[]) {
  const groups = new Map<string, Article[]>();
  for (const article of articles) {
    const key = clean(article.doi).toLowerCase() || clean(article.pmid) || normalizedTitle(article.title);
    if (!key) continue;
    const list = groups.get(key) || [];
    list.push(article);
    groups.set(key, list);
  }
  return Array.from(groups.values()).filter((items) => items.length > 1);
}

export default function ReviewPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [stage, setStage] = useState<"screening" | "fulltext" | "extraction" | "prisma">("screening");

  async function load() {
    try {
      setLoading(true);
      const response = await fetch("/api/library/list", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "تعذر تحميل المكتبة.");
      setArticles(Array.isArray(data?.articles) ? data.articles : []);
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "تعذر تحميل المكتبة.", tone: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function patch(id: string, value: Partial<Article>) {
    const response = await fetch("/api/library/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...value }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "تعذر تحديث السجل.");
    setArticles((current) => current.map((article) => (idOf(article) === id ? { ...article, ...data.article } : article)));
  }

  const duplicates = useMemo(() => duplicateGroups(articles), [articles]);
  const counts = useMemo(() => {
    const screening = (status: string) => articles.filter((a) => (a.screeningStatus || "unscreened") === status).length;
    const retrieved = articles.filter((a) => a.fullTextStatus === "retrieved").length;
    const unavailable = articles.filter((a) => a.fullTextStatus === "unavailable").length;
    return {
      total: articles.length,
      include: screening("include"),
      exclude: screening("exclude"),
      maybe: screening("maybe"),
      unscreened: screening("unscreened"),
      retrieved,
      unavailable,
      duplicateRecords: duplicates.reduce((sum, group) => sum + group.length - 1, 0),
    };
  }, [articles, duplicates]);

  const included = articles.filter((a) => a.screeningStatus === "include");

  return (
    <div className="min-h-screen bg-[#f6f8fb]" dir="rtl">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <section className="rounded-[30px] border border-slate-200 bg-slate-950 p-6 text-white shadow-xl sm:p-9">
          <p className="text-xs font-black tracking-[0.14em] text-blue-300">SYSTEMATIC REVIEW WORKSPACE</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">مساحة المراجعة المنهجية</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">فرز العنوان والملخص، إدارة النص الكامل، كشف التكرارات، أسباب الاستبعاد، واستخراج البيانات. أرقام PRISMA هنا مشتقة فقط من سجلات مكتبتك الحالية.</p>
        </section>

        <div className="mt-5 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {[
            ["screening", "فرز العنوان والملخص"],
            ["fulltext", "النص الكامل والتكرارات"],
            ["extraction", "استخراج البيانات"],
            ["prisma", "تدفق PRISMA"],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setStage(id as typeof stage)} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-black ${stage === id ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"}`}>{label}</button>
          ))}
        </div>

        <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {[
            ["إجمالي السجلات", counts.total], ["Include", counts.include], ["Exclude", counts.exclude], ["Maybe", counts.maybe], ["نص كامل", counts.retrieved], ["تكرارات محتملة", counts.duplicateRecords],
          ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-slate-950">{value}</p></div>)}
        </section>

        {loading ? <div className="mt-6 h-72 animate-pulse rounded-3xl border border-slate-200 bg-white" /> : null}

        {!loading && stage === "screening" ? (
          <section className="mt-6 space-y-3">
            {articles.map((article) => {
              const id = idOf(article);
              const current = article.screeningStatus || "unscreened";
              return (
                <article key={id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="grid gap-4 lg:grid-cols-[1fr_420px] lg:items-start">
                    <div>
                      <p className="text-xs font-bold text-blue-700">{article.journal || "مجلة غير محددة"}</p>
                      <h2 className="mt-2 text-lg font-black leading-7 text-slate-950">{article.title}</h2>
                      <p className="mt-3 line-clamp-4 text-sm leading-7 text-slate-600">{article.abstract || "لا يوجد ملخص متاح."}</p>
                    </div>
                    <div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {(["include", "exclude", "maybe", "unscreened"] as const).map((status) => (
                          <button key={status} onClick={() => patch(id, { screeningStatus: status }).catch(() => setToast({ message: "تعذر حفظ قرار الفرز.", tone: "error" }))} className={`rounded-xl px-3 py-2.5 text-xs font-black ${current === status ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}>{status}</button>
                        ))}
                      </div>
                      {current === "exclude" ? <input defaultValue={article.exclusionReason || ""} onBlur={(event) => patch(id, { exclusionReason: event.target.value })} placeholder="سبب الاستبعاد الإلزامي..." className="mt-3 w-full rounded-xl border border-red-200 px-3 py-2.5 text-sm outline-none focus:border-red-400" /> : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}

        {!loading && stage === "fulltext" ? (
          <section className="mt-6 grid gap-5 xl:grid-cols-[1fr_0.9fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black">إدارة النص الكامل</h2>
              <p className="mt-2 text-xs leading-6 text-slate-500">غيّر حالة النص الكامل للمصادر المضمّنة أو المحتملة. لا تعني “Retrieved” أن النظام قرأ الملف؛ تعني فقط أنك سجلت توفره.</p>
              <div className="mt-4 space-y-3">
                {articles.filter((a) => a.screeningStatus === "include" || a.screeningStatus === "maybe").map((article) => {
                  const id = idOf(article);
                  return <div key={id} className="rounded-2xl border border-slate-200 p-4"><h3 className="text-sm font-black leading-6">{article.title}</h3><select value={article.fullTextStatus || "pending"} onChange={(event) => patch(id, { fullTextStatus: event.target.value as Article["fullTextStatus"] })} className="mt-3 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"><option value="pending">بانتظار النص الكامل</option><option value="retrieved">تم الحصول عليه</option><option value="unavailable">غير متاح</option><option value="not-needed">غير مطلوب</option></select></div>;
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black">كشف التكرارات</h2>
              <p className="mt-2 text-xs leading-6 text-slate-500">التحقق يعتمد أولاً على DOI ثم PMID ثم عنوان مطبّع. لا يحذف شيئًا تلقائيًا.</p>
              <div className="mt-4 space-y-3">
                {duplicates.length === 0 ? <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">لا توجد تكرارات واضحة وفق القواعد الحالية.</p> : null}
                {duplicates.map((group, index) => <div key={index} className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black text-amber-800">مجموعة تكرار محتملة #{index + 1}</p><div className="mt-2 space-y-2">{group.map((article) => <div key={idOf(article)} className="rounded-xl bg-white p-3"><p className="text-sm font-bold leading-6">{article.title}</p><p className="mt-1 text-[11px] text-slate-500">DOI: {article.doi || "—"} • PMID: {article.pmid || "—"}</p></div>)}</div></div>)}
              </div>
            </div>
          </section>
        ) : null}

        {!loading && stage === "extraction" ? (
          <section className="mt-6 overflow-x-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black">جدول استخراج البيانات</h2>
            <p className="mt-2 text-xs leading-6 text-slate-500">الخانات تُحفظ يدويًا لكل دراسة مضمّنة. يمكن لاحقًا توسيع القالب حسب بروتوكول المراجعة.</p>
            <table className="mt-5 min-w-[1100px] w-full border-separate border-spacing-y-2 text-right text-xs">
              <thead><tr className="text-slate-500"><th className="px-3">الدراسة</th><th className="px-3">التصميم</th><th className="px-3">العينة</th><th className="px-3">المجتمع</th><th className="px-3">التعرض/التدخل</th><th className="px-3">النتائج</th><th className="px-3">ملاحظات</th></tr></thead>
              <tbody>
                {included.map((article) => {
                  const id = idOf(article);
                  const ext = article.extraction || {};
                  const fields = ["design", "sampleSize", "population", "exposure", "outcomes", "notes"];
                  return <tr key={id} className="bg-slate-50 align-top"><td className="max-w-[260px] rounded-r-xl p-3 font-black leading-6">{article.title}</td>{fields.map((fieldName, index) => <td key={fieldName} className={`p-2 ${index === fields.length - 1 ? "rounded-l-xl" : ""}`}><textarea defaultValue={ext[fieldName] || ""} onBlur={(event) => patch(id, { extraction: { ...ext, [fieldName]: event.target.value } })} className="min-h-20 min-w-32 w-full rounded-lg border border-slate-200 bg-white p-2 leading-5" /></td>)}</tr>;
                })}
              </tbody>
            </table>
          </section>
        ) : null}

        {!loading && stage === "prisma" ? (
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black">تدفق PRISMA — أرقام مشتقة من مساحة العمل</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">هذا ليس مخطط PRISMA نهائيًا للنشر؛ هو لوحة متابعة تُظهر الأعداد المسجلة حاليًا ولا تخترع سجلات قواعد بيانات لم يتم إدخالها.</p>
            <div className="mx-auto mt-8 max-w-2xl space-y-3 text-center">
              <PrismaBox title="السجلات في المكتبة" value={counts.total} />
              <Arrow />
              <PrismaBox title="تكرارات محتملة وفق DOI/PMID/العنوان" value={counts.duplicateRecords} tone="amber" />
              <Arrow />
              <PrismaBox title="سجلات غير مفحوصة" value={counts.unscreened} />
              <Arrow />
              <div className="grid gap-3 sm:grid-cols-3"><PrismaBox title="Include" value={counts.include} tone="green" /><PrismaBox title="Maybe" value={counts.maybe} tone="blue" /><PrismaBox title="Exclude" value={counts.exclude} tone="red" /></div>
              <Arrow />
              <div className="grid gap-3 sm:grid-cols-2"><PrismaBox title="نص كامل متاح" value={counts.retrieved} tone="green" /><PrismaBox title="نص كامل غير متاح" value={counts.unavailable} tone="red" /></div>
            </div>
          </section>
        ) : null}
      </main>
      {toast ? <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} /> : null}
    </div>
  );
}

function PrismaBox({ title, value, tone = "slate" }: { title: string; value: number; tone?: "slate" | "amber" | "green" | "blue" | "red" }) {
  const classes = { slate: "border-slate-200 bg-slate-50", amber: "border-amber-200 bg-amber-50", green: "border-emerald-200 bg-emerald-50", blue: "border-blue-200 bg-blue-50", red: "border-red-200 bg-red-50" };
  return <div className={`rounded-2xl border p-5 ${classes[tone]}`}><p className="text-sm font-black text-slate-800">{title}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></div>;
}

function Arrow() {
  return <div className="text-2xl font-black text-slate-300">↓</div>;
}
