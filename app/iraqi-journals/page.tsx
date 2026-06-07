import Link from "next/link";

export default function IraqiJournalsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <section className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold text-blue-700">Iraqi Journals</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">
              آخر أخبار المجلات العراقية
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              هذه الصفحة مخصصة لاحقاً لعرض أخبار المجلات العراقية المحلية
              والمصنفة وغير المصنفة، مع روابطها وحالة فهرستها.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white"
          >
            العودة للوحة التحكم
          </Link>
        </div>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
          سيتم ربط هذه الصفحة لاحقاً بملف بيانات أو API خاص بأخبار المجلات العراقية.
        </div>
      </section>
    </main>
  );
}