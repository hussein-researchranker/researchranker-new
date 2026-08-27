"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import type { SavedSearch, SearchAlert } from "@/lib/research-types";

export default function AlertsPage() {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [alerts, setAlerts] = useState<SearchAlert[]>([]);
  const [query, setQuery] = useState("");
  const [field, setField] = useState("all");
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const [searchResponse, alertResponse] = await Promise.all([
      fetch("/api/saved-searches", { cache: "no-store" }),
      fetch("/api/alerts", { cache: "no-store" }),
    ]);
    const searchData = await searchResponse.json();
    const alertData = await alertResponse.json();
    if (searchResponse.ok) setSearches(Array.isArray(searchData.searches) ? searchData.searches : []);
    if (alertResponse.ok) setAlerts(Array.isArray(alertData.alerts) ? alertData.alerts : []);
  }

  useEffect(() => {
    load();
  }, []);

  const unread = useMemo(() => alerts.filter((alert) => !alert.read).length, [alerts]);

  async function addSearch() {
    if (!query.trim()) return;
    const response = await fetch("/api/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, field, quartile: "All", enabled: true }),
    });
    const data = await response.json();
    if (response.ok) {
      setQuery("");
      setMessage("تم حفظ البحث. أول فحص يؤسس خط الأساس، وبعده تظهر الأوراق الجديدة فقط.");
      await load();
    } else setMessage(data?.error || "تعذر حفظ البحث.");
  }

  async function checkNow() {
    setChecking(true);
    setMessage("");
    try {
      const response = await fetch("/api/alerts/check", { method: "POST" });
      const data = await response.json();
      setMessage(response.ok ? `تم فحص ${data.checked || 0} بحث محفوظ، وإضافة ${data.created || 0} تنبيه جديد.` : data?.error || "فشل الفحص.");
      await load();
    } finally {
      setChecking(false);
    }
  }

  async function toggle(search: SavedSearch) {
    await fetch("/api/saved-searches", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: search.id, enabled: !search.enabled }),
    });
    await load();
  }

  async function remove(search: SavedSearch) {
    if (!confirm("حذف البحث المحفوظ وتنبيهاته؟")) return;
    await fetch("/api/saved-searches", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: search.id }),
    });
    await load();
  }

  async function markRead(alert: SearchAlert) {
    if (alert.read) return;
    await fetch("/api/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: alert.id, read: true }),
    });
    setAlerts((current) => current.map((item) => (item.id === alert.id ? { ...item, read: true } : item)));
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb]" dir="rtl">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-[30px] bg-slate-950 p-7 text-white shadow-xl sm:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-300">Saved Searches + Alerts</p>
              <h1 className="mt-3 text-3xl font-black sm:text-4xl">راقب الأدبيات بدل إعادة البحث كل مرة.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">يحفظ ResearchRanker استراتيجيات البحث، يقارن النتائج الجديدة بخط الأساس، ويعرض فقط المستجدات ذات الصلة مع relevance score.</p>
            </div>
            <div className="flex gap-3"><Stat label="بحوث محفوظة" value={searches.length} /><Stat label="تنبيهات غير مقروءة" value={unread} /></div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">
            <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addSearch()} placeholder="مثال: histone lactylation inflammation macrophage" className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-500" />
            <select value={field} onChange={(event) => setField(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold"><option value="all">كل التخصصات</option><option value="medicine">Medicine</option><option value="biochemistry">Biochemistry</option><option value="computer science">Computer Science</option></select>
            <button onClick={addSearch} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white">حفظ البحث</button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={checkNow} disabled={checking} className="rounded-xl bg-slate-950 px-5 py-2.5 text-xs font-black text-white disabled:opacity-50">{checking ? "جاري الفحص..." : "فحص المستجدات الآن"}</button>
            {message ? <p className="text-xs font-semibold text-slate-600">{message}</p> : null}
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">البحوث المحفوظة</h2>
            <div className="mt-4 space-y-3">
              {searches.length === 0 ? <Empty text="لم تحفظ أي بحث بعد." /> : searches.map((search) => (
                <article key={search.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div><h3 className="text-sm font-black text-slate-900">{search.query}</h3><p className="mt-1 text-xs text-slate-500">{search.field} • آخر فحص: {search.lastCheckedAt ? new Date(search.lastCheckedAt).toLocaleString("ar-IQ") : "لم يُفحص بعد"}</p></div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${search.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{search.enabled ? "نشط" : "متوقف"}</span>
                  </div>
                  <div className="mt-3 flex gap-2"><button onClick={() => toggle(search)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold">{search.enabled ? "إيقاف" : "تفعيل"}</button><Link href={`/results?q=${encodeURIComponent(search.query)}&field=${encodeURIComponent(search.field)}&quartile=${encodeURIComponent(search.quartile)}`} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold">فتح النتائج</Link><button onClick={() => remove(search)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">حذف</button></div>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><h2 className="text-lg font-black text-slate-950">المستجدات</h2><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{unread} جديد</span></div>
            <div className="mt-4 space-y-3">
              {alerts.length === 0 ? <Empty text="لا توجد أوراق جديدة بعد. الفحص الأول يؤسس خط الأساس ولا يولد تنبيهات قديمة." /> : alerts.map((alert) => (
                <article key={alert.id} onMouseEnter={() => markRead(alert)} className={`rounded-2xl border p-4 ${alert.read ? "border-slate-200 bg-white" : "border-blue-200 bg-blue-50/50"}`}>
                  <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-blue-700">Relevance {alert.relevanceScore}%</p><h3 className="mt-1 text-sm font-black leading-6 text-slate-950">{alert.title}</h3><p className="mt-1 text-xs text-slate-500">{alert.journal} {alert.pubdate ? `• ${alert.pubdate}` : ""}</p></div>{!alert.read ? <span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> : null}</div>
                  <div className="mt-3 flex gap-2">{alert.doi ? <Link href={`/article?doi=${encodeURIComponent(alert.doi)}`} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white">تفاصيل الورقة</Link> : <Link href={`/results?q=${encodeURIComponent(alert.title)}`} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white">ابحث عن الورقة</Link>}</div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) { return <div className="min-w-32 rounded-2xl border border-white/10 bg-white/10 p-4"><p className="text-[10px] font-bold text-slate-300">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">{text}</div>; }
