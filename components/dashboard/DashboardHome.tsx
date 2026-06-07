"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

export default function DashboardHome() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <section className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold text-blue-700">ResearchRanker</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">
              لوحة الأخبار والمجلات الأكاديمية
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              واجهة مبسطة للباحثين تساعدك على متابعة أخبار المجلات، تصنيفاتها،
              والانتقال إلى البحث عن المصادر حسب الربع المطلوب.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/search"
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
            >
              اذهب للبحث عن المصادر
            </Link>
            <UserButton />
          </div>
        </header>

        <div className="grid gap-5 md:grid-cols-3">
          <Link
            href="/iraqi-journals"
            className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <p className="text-sm font-bold text-emerald-700">
              آخر أخبار المجلات العراقية
            </p>
            <h2 className="mt-3 text-xl font-black text-slate-900">
              مجلات محلية ومصنفة
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              تابع المجلات العراقية، حالة الفهرسة، والتحديثات المهمة.
            </p>
          </Link>

          <Link
            href="/journals"
            className="rounded-3xl border border-purple-200 bg-purple-50 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <p className="text-sm font-bold text-purple-700">
              تصنيفات المجلات
            </p>
            <h2 className="mt-3 text-xl font-black text-slate-900">
              Journal Quartile Slider
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              عرض مبسط لتصنيفات المجلات Q1 وQ2 وQ3 وQ4.
            </p>
          </Link>

          <Link
            href="/search"
            className="rounded-3xl border border-blue-200 bg-blue-50 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <p className="text-sm font-bold text-blue-700">البحث العلمي</p>
            <h2 className="mt-3 text-xl font-black text-slate-900">
              ابحث حسب الربع والتخصص
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              اختر الربع أولاً، ثم اكتب العنوان أو الكلمات المفتاحية أو DOI.
            </p>
          </Link>
        </div>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-500">
                Exclusive Journal News
              </p>
              <h2 className="mt-1 text-2xl font-black text-slate-900">
                أخبار المجلات الحصرية
              </h2>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              "تحديثات الفهرسة والتصنيف",
              "تنبيهات المجلات المفترسة",
              "فرص النشر الأكاديمي",
            ].map((item) => (
              <article
                key={item}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
              >
                <h3 className="font-bold text-slate-900">{item}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  سيتم ربط هذا القسم لاحقاً بمصدر أخبار أو قاعدة بيانات داخلية.
                </p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}