"use client";

import { useState } from "react";
import Link from "next/link";

type Quartile = "Q1" | "Q2" | "Q3" | "Q4";

type FieldOption = {
  value: string;
  labelAr: string;
  labelEn: string;
};

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

export default function SearchWizard() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [quartile, setQuartile] = useState<Quartile | "">("");
  const [field, setField] = useState("all");
  const [query, setQuery] = useState("");

  function startSearch() {
    if (!quartile || !query.trim()) return;

    const params = new URLSearchParams({
      q: query.trim(),
      quartile,
      field,
    });

    window.location.href = `/advanced-search?${params.toString()}`;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10" dir="rtl">
      <section className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-blue-700">Search Wizard</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">
              البحث عن المصادر خطوة بخطوة
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              اختر الربع أولاً، ثم التخصص، وبعدها اكتب عنوان البحث أو الكلمات المفتاحية أو DOI.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700"
          >
            رجوع
          </Link>
        </div>

        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          <div
            className={`rounded-2xl border p-4 text-center text-sm font-bold ${
              step === 1 ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-500"
            }`}
          >
            1. الربع
          </div>
          <div
            className={`rounded-2xl border p-4 text-center text-sm font-bold ${
              step === 2 ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-500"
            }`}
          >
            2. التخصص
          </div>
          <div
            className={`rounded-2xl border p-4 text-center text-sm font-bold ${
              step === 3 ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-500"
            }`}
          >
            3. البحث
          </div>
        </div>

        {step === 1 && (
          <div>
            <h2 className="text-xl font-black text-slate-900">
              اختر الربع المطلوب
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              اختر Q1 أو Q2 أو Q3 أو Q4 قبل الانتقال إلى التخصص.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-4">
              {(["Q1", "Q2", "Q3", "Q4"] as Quartile[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setQuartile(item)}
                  className={`rounded-2xl border px-5 py-6 text-xl font-black transition ${
                    quartile === item
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!quartile}
              className="mt-8 w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              التالي
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-xl font-black text-slate-900">
              اختر التخصص
            </h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              اختيار التخصص يساعد على تقليل النتائج غير المرتبطة. مثلاً: عند اختيار علوم الحاسوب، سنرسل لاحقاً فلترة أدق إلى API.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {fieldOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setField(option.value)}
                  className={`rounded-2xl border p-4 text-right transition ${
                    field === option.value
                      ? "border-blue-600 bg-blue-50"
                      : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                  }`}
                >
                  <p className="font-black text-slate-900">{option.labelAr}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{option.labelEn}</p>
                </button>
              ))}
            </div>

            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-1/3 rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700"
              >
                رجوع
              </button>

              <button
                type="button"
                onClick={() => setStep(3)}
                className="w-2/3 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white"
              >
                التالي
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-xl font-black text-slate-900">
              اكتب موضوع البحث
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              يمكنك كتابة عنوان، كلمات مفتاحية، DOI، أو مصطلحات عربية/إنجليزية.
            </p>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-white p-3 text-sm font-bold text-slate-700">
                  الربع المختار: {quartile}
                </div>
                <div className="rounded-xl bg-white p-3 text-sm font-bold text-slate-700">
                  التخصص:{" "}
                  {fieldOptions.find((option) => option.value === field)?.labelAr || "كل التخصصات"}
                </div>
              </div>

              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") startSearch();
                }}
                placeholder="مثال: chronic kidney disease أو الذكاء الاصطناعي أو DOI"
                className="w-full rounded-xl border border-slate-300 bg-white p-4 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-1/3 rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700"
              >
                رجوع
              </button>

              <button
                type="button"
                onClick={startSearch}
                disabled={!query.trim()}
                className="w-2/3 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                بحث
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}