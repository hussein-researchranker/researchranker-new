export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 sm:px-6 sm:py-7" dir="rtl">
      <section className="mx-auto max-w-7xl">
        <div className="h-16 animate-pulse rounded-2xl bg-white shadow-sm" />
        <div className="mt-5 h-72 animate-pulse rounded-[32px] bg-slate-200" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-44 animate-pulse rounded-[26px] bg-white shadow-sm" />
          ))}
        </div>
      </section>
    </main>
  );
}
