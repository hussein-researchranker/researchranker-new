"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("ResearchRanker page error:", error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4" dir="rtl">
      <section className="w-full max-w-xl rounded-[28px] border border-slate-200 bg-white p-7 text-center shadow-xl">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-xl font-black text-rose-700">!</div>
        <h1 className="mt-5 text-2xl font-black text-slate-950">حدث خطأ غير متوقع</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          لم يتم إكمال العملية. لم نعرض بيانات تخمينية بدلاً من النتيجة الفاشلة. يمكنك إعادة المحاولة أو الرجوع إلى لوحة التحكم.
        </p>
        {error.digest ? <p className="mt-3 text-xs font-mono text-slate-400">Error reference: {error.digest}</p> : null}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button type="button" onClick={reset} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white">إعادة المحاولة</button>
          <Link href="/dashboard" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700">لوحة التحكم</Link>
        </div>
      </section>
    </main>
  );
}
