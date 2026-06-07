import Link from "next/link";

export default function JournalSlider() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <section className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold text-purple-700">
              Journal Classification
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">
              تصنيفات المجلات
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              صفحة مخصصة لاحقاً لعرض سلايدر المجلات وتصنيفاتها حسب Q1 وQ2 وQ3 وQ4.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white"
          >
            العودة للوحة التحكم
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {["Q1", "Q2", "Q3", "Q4"].map((quartile) => (
            <div
              key={quartile}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center"
            >
              <p className="text-2xl font-black text-slate-900">{quartile}</p>
              <p className="mt-2 text-sm text-slate-600">
                سيتم عرض المجلات هنا لاحقاً.
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}