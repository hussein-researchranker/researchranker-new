"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { LibraryArticle, ScreeningStatus } from "@/lib/research-types";

type Stage = "title-abstract" | "full-text";

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function idOf(article: LibraryArticle) {
  return clean(article.id || article.doi || article.pmid || article.title);
}

function canonical(article: LibraryArticle) {
  return clean(article.doi || article.pmid || article.title)
    .toLowerCase()
    .replace(/[^a-z0-9\p{L}\p{N}]+/gu, "");
}

function decisionOf(article: LibraryArticle, stage: Stage): ScreeningStatus {
  if (stage === "full-text") return article.fullTextStatus || "unscreened";
  return article.titleAbstractStatus || article.screeningStatus || "unscreened";
}

function reasonOf(article: LibraryArticle, stage: Stage) {
  if (stage === "full-text") return clean(article.fullTextReason);
  return clean(article.titleAbstractReason || article.screeningReason);
}

export default function ReviewPage() {
  const { isArabic } = useLocale();
  const [articles, setArticles] = useState<LibraryArticle[]>([]);
  const [stage, setStage] = useState<Stage>("title-abstract");
  const [filter, setFilter] = useState<"all" | ScreeningStatus>("all");
  const [active, setActive] = useState<LibraryArticle | null>(null);
  const [reason, setReason] = useState("");
  const [extraction, setExtraction] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  const t = isArabic
    ? {
        eyebrow: "مساحة المراجعة المنهجية",
        title: "فحص العنوان والملخص، ثم النص الكامل، مع مسار PRISMA قابل للتتبع.",
        intro:
          "تُسجّل قرارات الإدراج والاستبعاد وسبب كل قرار على مرحلتين مستقلتين، مع كشف محافظ للتكرارات وجدول لاستخراج بيانات الدراسات.",
        titleStage: "العنوان والملخص",
        fullStage: "النص الكامل",
        list: "قائمة الفحص",
        all: "كل السجلات",
        unscreened: "غير مفحوص",
        include: "إدراج",
        maybe: "محتمل",
        exclude: "استبعاد",
        choose: "اختر ورقة لبدء الفحص",
        chooseHint: "سيتم حفظ القرار والسبب داخل سجل الورقة نفسه.",
        reason: "سبب القرار / ملاحظة الفحص",
        reasonPlaceholder: "مثال: الفئة السكانية غير مطابقة، تصميم الدراسة غير مؤهل...",
        extraction: "استخراج البيانات",
        saveExtraction: "حفظ الاستخراج",
        article: "تفاصيل الورقة",
        library: "المكتبة",
        duplicates: "تكرارات محتملة",
        records: "السجلات",
        afterDedup: "بعد التكرارات المحتملة",
        taScreened: "فُحص عنوان/ملخص",
        taEligible: "انتقل للنص الكامل",
        ftAssessed: "فُحص نص كامل",
        finalInclude: "الإدراج النهائي",
        prismaNote:
          "هذه معاينة تشغيلية لمسار PRISMA مبنية على قراراتك الحالية. يجب مراجعة التكرارات وأسباب الاستبعاد يدويًا قبل استخدام الأرقام في تقرير منشور.",
        saved: "تم حفظ القرار",
        noRecords: "لا توجد سجلات في هذا الفلتر.",
        fullTextEligibility:
          "مرحلة النص الكامل تعرض فقط السجلات التي اجتازت مرحلة العنوان/الملخص كإدراج أو محتمل.",
      }
    : {
        eyebrow: "Systematic Review Workspace",
        title: "Title/abstract screening, full-text screening, and a traceable PRISMA workflow.",
        intro:
          "Record inclusion decisions and reasons independently at two screening stages, with conservative duplicate detection and structured study-data extraction.",
        titleStage: "Title & abstract",
        fullStage: "Full text",
        list: "Screening queue",
        all: "All records",
        unscreened: "Unscreened",
        include: "Include",
        maybe: "Maybe",
        exclude: "Exclude",
        choose: "Select a paper to begin screening",
        chooseHint: "The decision and reason are persisted on the article record.",
        reason: "Decision reason / screening note",
        reasonPlaceholder: "Example: ineligible population, wrong study design...",
        extraction: "Data extraction",
        saveExtraction: "Save extraction",
        article: "Article details",
        library: "Library",
        duplicates: "Potential duplicates",
        records: "Records",
        afterDedup: "After duplicate flagging",
        taScreened: "Title/abstract screened",
        taEligible: "Moved to full text",
        ftAssessed: "Full text assessed",
        finalInclude: "Final included",
        prismaNote:
          "This is an operational PRISMA preview derived from current decisions. Review duplicate groups and exclusion reasons manually before reporting final PRISMA counts.",
        saved: "Decision saved",
        noRecords: "No records match this filter.",
        fullTextEligibility:
          "The full-text stage shows only records marked Include or Maybe after title/abstract screening.",
      };

  async function load() {
    const response = await fetch("/api/library/list", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setArticles(Array.isArray(data.articles) ? data.articles : []);
    else setMessage(data?.error || (isArabic ? "تعذر تحميل المكتبة." : "Unable to load the library."));
  }

  useEffect(() => {
    load();
  }, []);

  const duplicateGroups = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const article of articles) {
      const key = canonical(article);
      const id = idOf(article);
      if (!key || !id) continue;
      const ids = groups.get(key) || [];
      ids.push(id);
      groups.set(key, ids);
    }
    return Array.from(groups.values()).filter((ids) => ids.length > 1);
  }, [articles]);

  const duplicateIds = useMemo(
    () => new Set(duplicateGroups.flat()),
    [duplicateGroups]
  );

  const counts = useMemo(() => {
    const titleScreened = articles.filter(
      (article) => decisionOf(article, "title-abstract") !== "unscreened"
    ).length;
    const titleEligible = articles.filter((article) => {
      const decision = decisionOf(article, "title-abstract");
      return decision === "include" || decision === "maybe";
    }).length;
    const fullTextAssessed = articles.filter((article) => {
      const titleDecision = decisionOf(article, "title-abstract");
      return (
        (titleDecision === "include" || titleDecision === "maybe") &&
        decisionOf(article, "full-text") !== "unscreened"
      );
    }).length;
    const finalIncluded = articles.filter(
      (article) => decisionOf(article, "full-text") === "include"
    ).length;

    return {
      total: articles.length,
      duplicateGroups: duplicateGroups.length,
      afterDedup: Math.max(0, articles.length - duplicateGroups.reduce((sum, group) => sum + Math.max(0, group.length - 1), 0)),
      titleScreened,
      titleEligible,
      fullTextAssessed,
      finalIncluded,
    };
  }, [articles, duplicateGroups]);

  const eligibleForStage = useMemo(() => {
    if (stage === "title-abstract") return articles;
    return articles.filter((article) => {
      const decision = decisionOf(article, "title-abstract");
      return decision === "include" || decision === "maybe";
    });
  }, [articles, stage]);

  const visible = useMemo(
    () =>
      eligibleForStage.filter(
        (article) => filter === "all" || decisionOf(article, stage) === filter
      ),
    [eligibleForStage, filter, stage]
  );

  function openArticle(article: LibraryArticle) {
    setActive(article);
    setReason(reasonOf(article, stage));
    setExtraction(article.extraction || {});
    setMessage("");
  }

  useEffect(() => {
    if (active) setReason(reasonOf(active, stage));
    setFilter("all");
  }, [stage]);

  async function setDecision(article: LibraryArticle, decision: ScreeningStatus) {
    const patch =
      stage === "full-text"
        ? { fullTextStatus: decision, fullTextReason: reason }
        : {
            titleAbstractStatus: decision,
            titleAbstractReason: reason,
            screeningStatus: decision,
            screeningReason: reason,
          };

    const response = await fetch("/api/library/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: idOf(article), ...patch }),
    });
    const data = await response.json();
    if (response.ok) {
      setArticles((current) =>
        current.map((item) => (idOf(item) === idOf(article) ? data.article : item))
      );
      setActive(data.article);
      setReason(reasonOf(data.article, stage));
      setMessage(`${t.saved}: ${decision}.`);
    } else {
      setMessage(data?.error || (isArabic ? "تعذر حفظ القرار." : "Unable to save decision."));
    }
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
      setArticles((current) =>
        current.map((item) => (idOf(item) === idOf(active) ? data.article : item))
      );
      setActive(data.article);
      setMessage(isArabic ? "تم حفظ جدول استخراج البيانات." : "Data extraction saved.");
    } else {
      setMessage(data?.error || (isArabic ? "تعذر حفظ الاستخراج." : "Unable to save extraction."));
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb]" dir={isArabic ? "rtl" : "ltr"}>
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-[30px] bg-slate-950 p-7 text-white shadow-xl sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
            {t.eyebrow}
          </p>
          <h1 className="mt-3 max-w-5xl text-3xl font-black sm:text-4xl">{t.title}</h1>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">{t.intro}</p>
        </section>

        <section className="mt-6 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label={t.records} value={counts.total} />
          <Stat label={t.duplicates} value={counts.duplicateGroups} />
          <Stat label={t.taScreened} value={counts.titleScreened} />
          <Stat label={t.taEligible} value={counts.titleEligible} />
          <Stat label={t.ftAssessed} value={counts.fullTextAssessed} />
          <Stat label={t.finalInclude} value={counts.finalIncluded} />
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Flow label={t.records} value={counts.total} />
            <Flow label={t.duplicates} value={counts.duplicateGroups} />
            <Flow label={t.afterDedup} value={counts.afterDedup} />
            <Flow label={t.taScreened} value={counts.titleScreened} />
            <Flow label={t.ftAssessed} value={counts.fullTextAssessed} />
            <Flow label={t.finalInclude} value={counts.finalIncluded} />
          </div>
          <p className="mt-4 text-xs leading-6 text-slate-500">{t.prismaNote}</p>
        </section>

        <section className="mt-6 flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-3 sm:flex-row sm:items-center">
          <button
            onClick={() => setStage("title-abstract")}
            className={`rounded-xl px-5 py-3 text-sm font-black ${
              stage === "title-abstract"
                ? "bg-blue-600 text-white"
                : "border border-blue-200 bg-white text-blue-800"
            }`}
          >
            1. {t.titleStage}
          </button>
          <button
            onClick={() => setStage("full-text")}
            className={`rounded-xl px-5 py-3 text-sm font-black ${
              stage === "full-text"
                ? "bg-blue-600 text-white"
                : "border border-blue-200 bg-white text-blue-800"
            }`}
          >
            2. {t.fullStage}
          </button>
          {stage === "full-text" ? (
            <p className="text-xs font-semibold leading-6 text-blue-900">{t.fullTextEligibility}</p>
          ) : null}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">
                  {stage === "title-abstract" ? t.titleStage : t.fullStage}
                </p>
                <h2 className="mt-1 text-lg font-black">{t.list}</h2>
              </div>
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as "all" | ScreeningStatus)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
              >
                <option value="all">{t.all}</option>
                <option value="unscreened">{t.unscreened}</option>
                <option value="include">{t.include}</option>
                <option value="maybe">{t.maybe}</option>
                <option value="exclude">{t.exclude}</option>
              </select>
            </div>

            <div className="mt-4 max-h-[760px] space-y-3 overflow-y-auto pe-1">
              {visible.map((article) => {
                const id = idOf(article);
                const decision = decisionOf(article, stage);
                return (
                  <button
                    key={id}
                    onClick={() => openArticle(article)}
                    className={`w-full rounded-2xl border p-4 text-start transition ${
                      active && idOf(active) === id
                        ? "border-blue-400 bg-blue-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black text-blue-700">
                          {article.journal} • {article.pubdate}
                        </p>
                        <h3 className="mt-1 line-clamp-3 text-sm font-black leading-6 text-slate-950">
                          {article.title}
                        </h3>
                      </div>
                      <DecisionBadge decision={decision} isArabic={isArabic} />
                    </div>
                    {duplicateIds.has(id) ? (
                      <p className="mt-2 text-[10px] font-black text-red-600">
                        ⚠ {t.duplicates}
                      </p>
                    ) : null}
                  </button>
                );
              })}
              {visible.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                  {t.noRecords}
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            {!active ? (
              <div className="grid min-h-[420px] place-items-center text-center">
                <div>
                  <h2 className="text-xl font-black">{t.choose}</h2>
                  <p className="mt-2 text-sm text-slate-500">{t.chooseHint}</p>
                </div>
              </div>
            ) : (
              <>
                <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">
                  {stage === "title-abstract" ? t.titleStage : t.fullStage}
                </p>
                <h2 className="mt-2 text-xl font-black leading-8 text-slate-950">{active.title}</h2>
                <p className="mt-2 text-xs leading-6 text-slate-500">
                  {active.authors} • {active.journal} • {active.pubdate}
                </p>
                <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                  <p className="max-h-48 overflow-y-auto text-xs leading-7 text-slate-700">
                    {active.abstract || (isArabic ? "الملخص غير متاح." : "Abstract unavailable.")}
                  </p>
                </div>

                <label className="mt-4 block text-xs font-bold text-slate-600">
                  {t.reason}
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"
                    placeholder={t.reasonPlaceholder}
                  />
                </label>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <button
                    onClick={() => setDecision(active, "include")}
                    className="rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white"
                  >
                    {t.include}
                  </button>
                  <button
                    onClick={() => setDecision(active, "maybe")}
                    className="rounded-xl bg-amber-500 px-4 py-3 text-xs font-black text-white"
                  >
                    {t.maybe}
                  </button>
                  <button
                    onClick={() => setDecision(active, "exclude")}
                    className="rounded-xl bg-red-600 px-4 py-3 text-xs font-black text-white"
                  >
                    {t.exclude}
                  </button>
                </div>

                <div className="mt-6 border-t border-slate-100 pt-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-violet-700">
                        {t.extraction}
                      </p>
                      <h3 className="mt-1 text-lg font-black">{t.extraction}</h3>
                    </div>
                    <button
                      onClick={saveExtraction}
                      className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white"
                    >
                      {t.saveExtraction}
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Field label={isArabic ? "الفئة السكانية" : "Population"} value={extraction.population || ""} onChange={(value) => setExtraction((current) => ({ ...current, population: value }))} />
                    <Field label={isArabic ? "تصميم الدراسة" : "Study design"} value={extraction.studyDesign || ""} onChange={(value) => setExtraction((current) => ({ ...current, studyDesign: value }))} />
                    <Field label={isArabic ? "حجم العينة" : "Sample size"} value={extraction.sampleSize || ""} onChange={(value) => setExtraction((current) => ({ ...current, sampleSize: value }))} />
                    <Field label={isArabic ? "التعرض / التدخل" : "Exposure / intervention"} value={extraction.exposure || ""} onChange={(value) => setExtraction((current) => ({ ...current, exposure: value }))} />
                    <Field label={isArabic ? "المقارنة" : "Comparator"} value={extraction.comparator || ""} onChange={(value) => setExtraction((current) => ({ ...current, comparator: value }))} />
                    <Field label={isArabic ? "النتيجة الرئيسية" : "Key outcome"} value={extraction.outcome || ""} onChange={(value) => setExtraction((current) => ({ ...current, outcome: value }))} />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {active.doi ? (
                    <Link
                      href={`/article?doi=${encodeURIComponent(active.doi)}&id=${encodeURIComponent(idOf(active))}`}
                      className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-black"
                    >
                      {t.article}
                    </Link>
                  ) : null}
                  <Link
                    href="/library"
                    className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-black"
                  >
                    {t.library}
                  </Link>
                </div>

                {message ? (
                  <p className="mt-4 rounded-xl bg-blue-50 p-3 text-xs font-semibold text-blue-800">
                    {message}
                  </p>
                ) : null}
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function DecisionBadge({
  decision,
  isArabic,
}: {
  decision: ScreeningStatus;
  isArabic: boolean;
}) {
  const label =
    decision === "include"
      ? isArabic
        ? "إدراج"
        : "Include"
      : decision === "exclude"
        ? isArabic
          ? "استبعاد"
          : "Exclude"
        : decision === "maybe"
          ? isArabic
            ? "محتمل"
            : "Maybe"
          : isArabic
            ? "غير مفحوص"
            : "Unscreened";
  const classes =
    decision === "include"
      ? "bg-emerald-50 text-emerald-700"
      : decision === "exclude"
        ? "bg-red-50 text-red-700"
        : decision === "maybe"
          ? "bg-amber-50 text-amber-700"
          : "bg-slate-100 text-slate-500";
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${classes}`}>{label}</span>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function Flow({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 text-center">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-blue-700">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs font-bold text-slate-600">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal"
      />
    </label>
  );
}
