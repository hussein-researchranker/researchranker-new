import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4" dir="rtl">
      <section className="w-full max-w-xl rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-xl">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">404</p>
        <h1 className="mt-3 text-3xl font-black text-slate-950">الصفحة غير موجودة</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">قد يكون الرابط قديماً أو غير صحيح. ارجع إلى لوحة التحكم أو ابدأ بحثاً أكاديمياً جديداً.</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/dashboard" className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white">لوحة التحكم</Link>
          <Link href="/search" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700">بحث جديد</Link>
        </div>
      </section>
    </main>
  );
}
