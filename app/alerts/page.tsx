"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import Toast from "@/components/ui/Toast";

type SavedSearch = {
  id: string;
  query: string;
  quartile: string;
  field: string;
  alertEnabled: boolean;
  createdAt: string;
  lastCheckedAt?: string;
  lastResultCount?: number;
};

type AlertItem = {
  id: string;
  title: string;
  year?: number | null;
  publicationDate?: string;
  doi?: string;
  relevanceScore?: number;
  citedByCount?: number;
  openAccess?: boolean;
  quartile?: string;
  detectedAt?: string;
  source?: string;
};

type ToastState = { message: string; tone: "success" | "error" | "info" };

export default function AlertsPage() {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [query, setQuery] = useState("");
  const [quartile, setQuartile] = useState("All");
  const [field, setField] = useState("all");
  const [alerts, setAlerts] = useState<Record<string, AlertItem[]>>({});
  const [checking, setChecking] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);

  async function loadAlertsForSearch(id: string) {
    try {
      const response = await fetch(`/api/saved-searches/check?id=${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      if (!response.ok) return [] as AlertItem[];
      const data = await response.json();
      return Array.isArray(data?.alerts) ? data.alerts : [];
    } catch {
      return [] as AlertItem[];
    }
  }

  async function loadSearches() {
    try {
      setLoading(true);
      const response = await fetch("/api/saved-searches", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      const nextSearches = Array.isArray(data?.searches) ? data.searches : [];
      setSearches(nextSearches);

      const loaded = await Promise.all(
        nextSearches.map(async (search: SavedSearch) => [
          search.id,
          await loadAlertsForSearch(search.id),
        ] as const)
      );
      setAlerts(Object.fromEntries(loaded));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSearches();
  }, []);

  async function saveSearch() {
    if (!query.trim()) return;
    try {
      const response = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), quartile, field, alertEnabled: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "تعذر حفظ البحث.");
      setSearches((current) => [
        data.search,
        ...current.filter((item) => item.id !== data.search.id),
      ]);
      setAlerts((current) => ({ ...current, [data.search.id]: current[data.search.id] || [] }));
      setQuery("");
      setToast({
        message: "تم حفظ البحث. أول تحقق سيبني خط أساس دون اعتبار الأوراق القديمة نتائج جديدة.",
        tone: "success",
      });
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "تعذر حفظ البحث.",
        tone: "error",
      });
    }
  }

  async function checkSearch(id: string) {
    try {
      setChecking((current) => ({ ...current, [id]: true }));
      const response = await fetch("/api/saved-searches/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "تعذر التحقق من البحث.");
      setAlerts((current) => ({
        ...current,
        [id]: Array.isArray(data?.alerts) ? data.alerts : [],
      }));
      setSearches((current) =>
        current.map((item) => (item.id === id ? data.search : item))
      );

      if (data?.initialized) {
        setToast({
          message: "تم إنشاء خط الأساس. ستظهر في المرات التالية الأوراق المكتشفة حديثًا فقط.",
          tone: "info",
        });
      } else {
        const count = Number(data?.newCount) || 0;
        setToast({
          message: count
            ? `تم اكتشاف ${count} ورقة جديدة تجاوزت عتبة الصلة.`
            : "لا توجد أوراق جديدة تجاوزت عتبة الصلة الحالية.",
          tone: count ? "success" : "info",
        });
      }
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "تعذر التحقق من البحث.",
        tone: "error",
      });
    } finally {
      setChecking((current) => ({ ...current, [id]: false }));
    }
  }

  async function toggleSearch(search: SavedSearch) {
    try {
      const response = await fetch("/api/saved-searches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: search.id, alertEnabled: !search.alertEnabled }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "تعذر تحديث التنبيه.");
      setSearches((current) =>
        current.map((item) => (item.id === search.id ? data.search : item))
      );
      setToast({
        message: data.search.alertEnabled ? "تم تفعيل التنبيه." : "تم إيقاف التنبيه.",
        tone: "success",
      });
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "تعذر تحديث التنبيه.",
        tone: "error",
      });
    }
  }

  async function deleteSearch(id: string) {
    const response = await fetch("/api/saved-searches", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (response.ok) {
      setSearches((current) => current.filter((item) => item.id !== id));
      setAlerts((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setToast({ message: "تم حذف البحث والتنبيهات المرتبطة به.", tone: "success" });
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb]" dir="rtl">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-slate-950 p-6 text-white shadow-xl sm:p-9">
          <p className="text-xs font-black tracking-[0.14em] text-blue-300">
            SAVED SEARCHES & ALERTS
          </p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            البحوث المحفوظة والتنبيهات
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
            احفظ سؤالك البحثي وافحص الأوراق المكتشفة حديثًا بدرجة صلة شفافة. أول
            فحص ينشئ خط أساس حتى لا تُعرض الأوراق القديمة على أنها جديدة، وتبقى
            التنبيهات المكتشفة محفوظة بعد تحديث الصفحة.
          </p>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-black text-slate-950">حفظ بحث جديد</h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && saveSearch()}
              placeholder="مثال: histone lactylation inflammation"
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
            />
            <select
              value={quartile}
              onChange={(event) => setQuartile(event.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold"
            >
              <option value="All">كل الأرباع</option>
              <option value="Q1">Q1</option>
              <option value="Q2">Q2</option>
              <option value="Q3">Q3</option>
              <option value="Q4">Q4</option>
            </select>
            <select
              value={field}
              onChange={(event) => setField(event.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold"
            >
              <option value="all">كل التخصصات</option>
              <option value="biomedical">طبي/حياتي</option>
              <option value="chemistry">كيمياء</option>
              <option value="computer-science">علوم حاسوب</option>
              <option value="engineering">هندسة</option>
            </select>
            <button
              onClick={saveSearch}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white"
            >
              حفظ وتفعيل
            </button>
          </div>
        </section>

        <section className="mt-6 space-y-4">
          {loading ? (
            <div className="h-48 animate-pulse rounded-3xl border border-slate-200 bg-white" />
          ) : null}
          {!loading && searches.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
              لا توجد بحوث محفوظة بعد.
            </div>
          ) : null}

          {searches.map((search) => (
            <article
              key={search.id}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-black text-slate-950">{search.query}</h2>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                        search.alertEnabled
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {search.alertEnabled ? "مفعّل" : "متوقف"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {search.quartile} • {search.field} • التنبيهات المحفوظة: {(alerts[search.id] || []).length}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    آخر تحقق: {search.lastCheckedAt ? new Date(search.lastCheckedAt).toLocaleString("ar-IQ") : "لم يُفحص بعد"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => checkSearch(search.id)}
                    disabled={checking[search.id] || !search.alertEnabled}
                    className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40"
                  >
                    {checking[search.id] ? "جارٍ الفحص..." : "تحقق من الجديد"}
                  </button>
                  <button
                    onClick={() => toggleSearch(search)}
                    className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-black text-slate-700"
                  >
                    {search.alertEnabled ? "إيقاف التنبيه" : "تفعيل التنبيه"}
                  </button>
                  <Link
                    href={`/results?q=${encodeURIComponent(search.query)}&quartile=${encodeURIComponent(search.quartile)}&field=${encodeURIComponent(search.field)}`}
                    className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-black text-slate-700"
                  >
                    فتح النتائج
                  </Link>
                  <button
                    onClick={() => deleteSearch(search.id)}
                    className="rounded-xl border border-red-200 px-4 py-2.5 text-xs font-black text-red-600"
                  >
                    حذف
                  </button>
                </div>
              </div>

              {(alerts[search.id] || []).length ? (
                <div className="mt-5 border-t border-slate-100 pt-5">
                  <p className="text-xs font-black text-emerald-700">
                    سجل الأوراق المكتشفة بعد خط الأساس
                  </p>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    {alerts[search.id].map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-sm font-black leading-6 text-slate-950">
                            {item.title}
                          </h3>
                          <span className="shrink-0 rounded-full bg-blue-100 px-2 py-1 text-[11px] font-black text-blue-700">
                            {item.relevanceScore}%
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          {item.publicationDate || item.year || "تاريخ غير متاح"} • استشهادات: {item.citedByCount ?? 0}
                          {item.quartile ? ` • ${item.quartile}` : ""}
                        </p>
                        {item.detectedAt ? (
                          <p className="mt-1 text-[11px] text-slate-400">
                            اكتُشفت: {new Date(item.detectedAt).toLocaleString("ar-IQ")}
                          </p>
                        ) : null}
                        <div className="mt-3 flex gap-2">
                          {item.doi ? (
                            <Link
                              href={`/article?doi=${encodeURIComponent(item.doi)}`}
                              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white"
                            >
                              تفاصيل
                            </Link>
                          ) : null}
                          {item.doi ? (
                            <a
                              href={`https://doi.org/${item.doi}`}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black text-slate-700"
                            >
                              DOI
                            </a>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </section>
      </main>
      {toast ? (
        <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />
      ) : null}
    </div>
  );
}
