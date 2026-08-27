"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Quartile = "All" | "Q1" | "Q2" | "Q3" | "Q4";

type FieldOption = {
  value: string;
  labelAr: string;
  labelEn: string;
};

const quartileOptions: Array<{
  value: Quartile;
  label: string;
  description: string;
}> = [
  { value: "All", label: "الكل", description: "موصى به للعثور على المصدر أولاً" },
  { value: "Q1", label: "Q1", description: "الربع الأول" },
  { value: "Q2", label: "Q2", description: "الربع الثاني" },
  { value: "Q3", label: "Q3", description: "الربع الثالث" },
  { value: "Q4", label: "Q4", description: "الربع الرابع" },
];

const fieldOptions: FieldOption[] = [
  { value: "all", labelAr: "كل التخصصات", labelEn: "All fields" },
  { value: "medicine", labelAr: "الطب والعلوم الصحية", labelEn: "Medicine & Health Sciences" },
  { value: "life-sciences", labelAr: "علوم الحياة", labelEn: "Life Sciences" },
  { value: "biochemistry", labelAr: "الكيمياء الحياتية", labelEn: "Biochemistry" },
  { value: "chemistry", labelAr: "الكيمياء", labelEn: "Chemistry" },
  { value: "physics", labelAr: "الفيزياء", labelEn: "Physics" },
  { value: "computer-science", labelAr: "علوم الحاسوب", labelEn: "Computer Science" },
  { value: "engineering", labelAr: "الهندسة", labelEn: "Engineering" },
  { value: "mathematics", labelAr: "الرياضيات", labelEn: "Mathematics" },
  { value: "environmental-science", labelAr: "علوم البيئة", labelEn: "Environmental Science" },
  { value: "agriculture", labelAr: "الزراعة", labelEn: "Agriculture" },
  { value: "education", labelAr: "التربية وطرائق التدريس", labelEn: "Education" },
  { value: "psychology", labelAr: "علم النفس", labelEn: "Psychology" },
  { value: "social-sciences", labelAr: "العلوم الاجتماعية", labelEn: "Social Sciences" },
  { value: "business", labelAr: "الإدارة والأعمال", labelEn: "Business & Management" },
  { value: "economics", labelAr: "الاقتصاد", labelEn: "Economics" },
  { value: "law", labelAr: "القانون", labelEn: "Law" },
  { value: "arts-humanities", labelAr: "الآداب والعلوم الإنسانية", labelEn: "Arts & Humanities" },
  { value: "linguistics", labelAr: "اللغة واللسانيات", labelEn: "Linguistics" },
  { value: "literature", labelAr: "الأدب", labelEn: "Literature" },
  { value: "history", labelAr: "التاريخ", labelEn: "History" },
  { value: "geography", labelAr: "الجغرافية", labelEn: "Geography" },
];

const examples = [
  "الإجهاد التأكسدي لدى مرضى غسيل الكلى",
  "artificial intelligence in clinical chemistry",
  "10.1016/j.procs.2020.09.151",
];

function looksLikeDoi(value: string) {
  return /10\.\d{4,9}\//i.test(value);
}

export default function SearchWizard() {
  const [quartile, setQuartile] = useState<Quartile>("All");
  const [field, setField] = useState("all");
  const [query, setQuery] = useState("");
  const [showFields, setShowFields] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const detectedDoi = useMemo(() => looksLikeDoi(query), [query]);
  const selectedField = useMemo(
    () => fieldOptions.find((option) => option.value === field) || fieldOptions[0],
    [field]
  );

  useEffect(() => {
    inputRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (event.key === "/" && !typing) {
        event.preventDefault();
        inputRef.current?.focus();
      }

      if (event.key === "Escape") {
        setShowFields(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function startSearch() {
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    const effectiveQuartile = looksLikeDoi(cleanQuery) ? "All" : quartile;
    const effectiveField = looksLikeDoi(cleanQuery) ? "all" : field;
    const params = new URLSearchParams({
      q: cleanQuery,
      quartile: effectiveQuartile,
      field: effectiveField,
    });

    window.location.href = `/results?${params.toString()}`;
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startSearch();
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe_0,#f8fafc_34%,#f8fafc_100%)] px-3 py-4 sm:px-6 sm:py-8" dir="rtl">
      <section className="mx-auto max-w-6xl">
        <header className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-xl sm:px-5">
          <Link href="/dashboard" className="flex items-center gap-3 rounded-xl">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-sm font-black text-white">R</div>
            <div>
              <p className="text-sm font-black text-slate-950">ResearchRanker</p>
              <p className="hidden text-xs text-slate-500 sm:block">Academic Search</p>
            </div>
          </Link>
          <div className="flex gap-2">
            <Link href="/journals" className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 sm:inline-flex">تحقق من مجلة</Link>
            <Link href="/dashboard" className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white">لوحة التحكم</Link>
          </div>
        </header>

        <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-slate-950 p-5 text-white shadow-2xl sm:p-8 lg:p-10">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-300">Evidence-first academic discovery</p>
            <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">ابحث مباشرة، ثم دع النظام يتحقق من بيانات المصدر.</h1>
            <p className="mt-4 text-sm leading-8 text-slate-300 sm:text-base">
              اكتب بالعربية أو الإنجليزية، الصق عنواناً كاملاً، أو أدخل DOI. البحث عن DOI يتجاوز تلقائياً فلاتر الربع والتخصص حتى لا تُخفى النتيجة الصحيحة.
            </p>
          </div>

          <form onSubmit={submit} className="mt-7 rounded-[24px] bg-white p-2 shadow-2xl">
            <div className="flex flex-col gap-2 md:flex-row">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="موضوع البحث، العنوان، الكلمات المفتاحية، أو DOI"
                  aria-label="موضوع البحث"
                  className="min-h-14 w-full rounded-2xl border border-transparent bg-slate-50 px-4 pe-14 text-sm font-bold text-slate-950 outline-none placeholder:font-medium placeholder:text-slate-400 focus:border-blue-300 focus:bg-white"
                />
                <kbd className="pointer-events-none absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-black text-slate-400 sm:block">/</kbd>
              </div>
              <button
                type="submit"
                disabled={!query.trim()}
                className="min-h-14 rounded-2xl bg-blue-600 px-7 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50"
              >
                بحث الآن
              </button>
            </div>

            {detectedDoi ? (
              <div className="mt-2 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold leading-6 text-emerald-800">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                تم اكتشاف DOI. سيتم البحث المباشر عن المعرف باستخدام مصادر metadata متعددة، ولن يطبق فلتر Q أو التخصص على هذه العملية.
              </div>
            ) : null}
          </form>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-blue-700">Quartile filter</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">الربع المطلوب</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{detectedDoi ? "All (DOI)" : quartile}</span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-2 xl:grid-cols-5">
              {quartileOptions.map((item) => {
                const active = (detectedDoi ? "All" : quartile) === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    disabled={detectedDoi && item.value !== "All"}
                    onClick={() => setQuartile(item.value)}
                    className={`rounded-2xl border p-3 text-center ${
                      active
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                    }`}
                  >
                    <p className="font-black">{item.label}</p>
                    <p className={`mt-1 hidden text-[10px] leading-4 xl:block ${active ? "text-blue-100" : "text-slate-400"}`}>{item.description}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium leading-6 text-amber-900">
              اختيار Q يفلتر العرض، لكنه لا يجعل تصنيف المجلة مؤكداً. حالة التحقق تُعرض لكل نتيجة بصورة مستقلة.
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-violet-700">Field context</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">التخصص</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowFields((current) => !current)}
                disabled={detectedDoi}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-white disabled:opacity-50"
              >
                {detectedDoi ? "كل التخصصات (DOI)" : selectedField.labelAr}
              </button>
            </div>

            {showFields && !detectedDoi ? (
              <div className="mt-4 max-h-[360px] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {fieldOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setField(option.value);
                        setShowFields(false);
                      }}
                      className={`rounded-xl border p-3 text-right ${
                        field === option.value
                          ? "border-violet-500 bg-violet-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <p className="text-sm font-black text-slate-900">{option.labelAr}</p>
                      <p className="mt-1 text-[11px] font-medium text-slate-400">{option.labelEn}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold text-slate-400">التخصص الحالي</p>
                  <p className="mt-1 font-black text-slate-950">{detectedDoi ? "كل التخصصات" : selectedField.labelAr}</p>
                  <p className="mt-1 text-xs text-slate-500">{detectedDoi ? "Exact identifier search" : selectedField.labelEn}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold text-slate-400">لغة البحث</p>
                  <p className="mt-1 font-black text-slate-950">العربية والإنجليزية</p>
                  <p className="mt-1 text-xs text-slate-500">المصطلحات العربية تُحوّل إلى صياغة أكاديمية محافظة عند الحاجة.</p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="mt-5 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-black text-slate-950">أمثلة سريعة للاختبار</h2>
              <p className="mt-1 text-xs leading-6 text-slate-500">اضغط على مثال لوضعه في صندوق البحث ثم عدّله كما تريد.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => {
                    setQuery(example);
                    inputRef.current?.focus();
                  }}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-white"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
