"use client";

import { useState } from "react";
import Link from "next/link";

type Quartile = "Q1" | "Q2" | "Q3" | "Q4";

export default function SearchWizard() {
  const [step, setStep] = useState<1 | 2>(1);
  const [quartile, setQuartile] = useState<Quartile | "">("");
  const [query, setQuery] = useState("");

  function startSearch() {
    if (!quartile || !query.trim()) return;

    const params = new URLSearchParams({
      q: query.trim(),
      quartile,
    });

    window.location.href = `/advanced-search?${params.toString()}`;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <section className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-blue-700">Search Wizard</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">
              البحث عن المصادر خطوة بخطوة
            </h1>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700"
          >
            رجوع
          </Link>
        </div>

        {step === 1 && (
          <div>
            <h2 className="text-xl font-black text-slate-900">
              اختر الربع المطلوب
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              اختر Q1 أو Q2 أو Q3 أو Q4 قبل البحث.
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
              اكتب موضوع البحث
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              يمكنك كتابة عنوان، كلمات مفتاحية، DOI، أو مصطلحات عربية/إنجليزية.
            </p>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-3 text-sm font-bold text-slate-600">
                الربع المختار: {quartile}
              </p>
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
                onClick={() => setStep(1)}
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