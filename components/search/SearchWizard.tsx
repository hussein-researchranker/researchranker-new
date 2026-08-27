"use client";

import { useState } from "react";
import AppHeader from "@/components/layout/AppHeader";

type Quartile = "Q1" | "Q2" | "Q3" | "Q4";
type FieldOption = { value: string; labelAr: string; labelEn: string };

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

const quartileMeta: Record<Quartile, { description: string; classes: string }> = {
  Q1: { description: "أعلى 25% من المجلات ضمن الفئة", classes: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  Q2: { description: "الربع الثاني ضمن الفئة", classes: "border-blue-200 bg-blue-50 text-blue-800" },
  Q3: { description: "الربع الثالث ضمن الفئة", classes: "border-amber-200 bg-amber-50 text-amber-800" },
  Q4: { description: "الربع الرابع ضمن الفئة", classes: "border-rose-200 bg-rose-50 text-rose-800" },
};

export default function SearchWizard() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [quartile, setQuartile] = useState<Quartile | "">("");
  const [field, setField] = useState("all");
  const [query, setQuery] = useState("");

  function startSearch() {
    if (!quartile || !query.trim()) return;
    const params = new URLSearchParams({ q: query.trim(), quartile, field });
    window.location.href = `/results?${params.toString()}`;
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb]" dir="rtl">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="grid overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm lg:grid-cols-[0.72fr_1.28fr]">
          <aside className="relative overflow-hidden bg-slate-950 p-7 text-white sm:p-9">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(59,130,246,0.35),transparent_35%),radial-gradient(circle_at_80%_85%,rgba(99,102,241,0.28),transparent_32%)]" />
            <div className="relative">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-300">Search workflow</p>
              <h1 className="mt-3 text-3xl font-black leading-tight">ابحث بطريقة منظّمة، لا بمجرد صندوق بحث.</h1>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                حدّد مستوى المجلة المطلوب والتخصص ثم اكتب سؤالك. سيحافظ النظام على الحالات غير المؤكدة منفصلة عن التصنيفات الموثقة.
              </p>

              <div className="mt-8 space-y-3">
                {[
                  [1, "حدد الربع", "Q1 إلى Q4"],
                  [2, "حدد التخصص", "لتقليل النتائج غير المرتبطة"],
                  [3, "اكتب السؤال", "عنوان، كلمات مفتاحية أو DOI"],
                ].map(([number, title, description]) => (
                  <button
                    key={String(number)}
                    type="button"
                    onClick={() => {
                      if (number === 1) setStep(1);
                      if (number === 2 && quartile) setStep(2);
                      if (number === 3 && quartile) setStep(3);
                    }}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-right ${
                      step === number ? "border-white/25 bg-white/15" : "border-white/10 bg-white/5"
                    }`}
                  >
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-black ${step === number ? "bg-white text-slate-950" : "bg-white/10 text-white"}`}>
                      0{number}
                    </span>
                    <span>
                      <span className="block text-sm font-black">{title}</span>
                      <span className="mt-0.5 block text-xs text-slate-400">{description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div className="p-6 sm:p-9">
            <div className="mb-7 flex items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Step {step} of 3</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">ResearchRanker search setup</p>
              </div>
              <div className="flex gap-1.5" aria-hidden="true">
                {[1, 2, 3].map((item) => (
                  <span key={item} className={`h-1.5 w-9 rounded-full ${item <= step ? "bg-blue-600" : "bg-slate-200"}`} />
                ))}
              </div>
            </div>

            {step === 1 && (
              <div>
                <h2 className="text-2xl font-black text-slate-950">ما مستوى المجلة الذي تستهدفه؟</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">الربع هو فلتر بحث، وليس ضماناً تلقائياً؛ النظام سيعرض حالة التحقق لكل نتيجة.</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {(["Q1", "Q2", "Q3", "Q4"] as Quartile[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => { setQuartile(item); setStep(2); }}
                      className={`rounded-2xl border p-5 text-right transition hover:-translate-y-0.5 hover:shadow-md ${quartileMeta[item].classes}`}
                    >
                      <span className="text-2xl font-black">{item}</span>
                      <span className="mt-2 block text-xs font-bold opacity-80">{quartileMeta[item].description}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="text-2xl font-black text-slate-950">اختر المجال العلمي</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">يمكنك اختيار كل التخصصات إذا كان موضوعك متعدد المجالات.</p>
                <div className="mt-6 max-h-[470px] grid gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {fieldOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => { setField(option.value); setStep(3); }}
                      className={`rounded-2xl border p-4 text-right transition hover:border-blue-300 hover:bg-blue-50 ${field === option.value ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white"}`}
                    >
                      <p className="text-sm font-black text-slate-950">{option.labelAr}</p>
                      <p className="mt-1 text-[11px] font-bold text-slate-500">{option.labelEn}</p>
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setStep(1)} className="mt-5 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700">رجوع</button>
              </div>
            )}

            {step === 3 && (
              <div>
                <h2 className="text-2xl font-black text-slate-950">اكتب سؤالك أو موضوع البحث</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">استخدم مصطلحات محددة. يمكنك البحث بعنوان، كلمات مفتاحية، DOI أو PMID.</p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700">{quartile}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700">
                    {fieldOptions.find((option) => option.value === field)?.labelAr || "كل التخصصات"}
                  </span>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-50">
                  <textarea
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        startSearch();
                      }
                    }}
                    rows={5}
                    autoFocus
                    placeholder="مثال: association between zonulin and inflammation in hemodialysis patients"
                    className="w-full resize-none bg-transparent text-base font-semibold leading-7 text-slate-950 outline-none placeholder:font-normal placeholder:text-slate-400"
                  />
                </div>

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                  <button type="button" onClick={() => setStep(2)} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700">تعديل التخصص</button>
                  <button type="button" onClick={startSearch} disabled={!query.trim()} className="rounded-xl bg-blue-600 px-7 py-3 text-sm font-black text-white shadow-sm hover:bg-blue-700 disabled:opacity-40">عرض النتائج</button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
