import Link from "next/link";
import path from "path";
import { readFile } from "fs/promises";

type IraqiJournal = {
  name: string;
  publisher: string;
  field: string;
  status: "مصنفة" | "محلية" | "تحتاج تحقق";
  quartile: "Q1" | "Q2" | "Q3" | "Q4" | "غير مؤكد";
  indexing: string;
  note: string;
  url?: string;
};

type JournalNews = {
  title: string;
  tag: string;
  description: string;
};

type IraqiJournalsData = {
  journals: IraqiJournal[];
  news: JournalNews[];
  alerts: string[];
};

async function loadIraqiJournalsData(): Promise<IraqiJournalsData> {
  const filePath = path.join(process.cwd(), "data", "iraqi-journals.json");
  const fileContent = await readFile(filePath, "utf8");

  return JSON.parse(fileContent) as IraqiJournalsData;
}

function getStatusClass(status: IraqiJournal["status"]) {
  if (status === "مصنفة") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "محلية") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function getQuartileClass(quartile: IraqiJournal["quartile"]) {
  if (quartile === "Q1") return "bg-emerald-600 text-white";
  if (quartile === "Q2") return "bg-blue-600 text-white";
  if (quartile === "Q3") return "bg-amber-500 text-white";
  if (quartile === "Q4") return "bg-red-500 text-white";
  return "bg-slate-100 text-slate-600";
}

export default async function IraqiJournalsPage() {
  const data = await loadIraqiJournalsData();

  const iraqiJournals = data.journals || [];
  const journalNews = data.news || [];
  const alerts = data.alerts || [];

  const classifiedCount = iraqiJournals.filter(
    (journal) => journal.status === "مصنفة"
  ).length;

  const localCount = iraqiJournals.filter(
    (journal) => journal.status === "محلية"
  ).length;

  const needsCheckCount = iraqiJournals.filter(
    (journal) => journal.status === "تحتاج تحقق"
  ).length;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8" dir="rtl">
      <section className="mx-auto max-w-7xl">
        <header className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-bold text-blue-700">
                Iraqi Journals Intelligence
              </p>
              <h1 className="mt-2 text-3xl font-black text-slate-900">
                أخبار وتصنيفات المجلات العراقية
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                صفحة مخصصة لمساعدة الباحثين على متابعة المجلات العراقية، معرفة
                حالة الفهرسة، والتمييز بين المجلات المحلية والمجلات التي تحتاج
                تحققاً يدوياً قبل الاعتماد الأكاديمي.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/search"
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
              >
                اذهب للبحث عن المصادر
              </Link>

              <Link
                href="/journals"
                className="rounded-xl border border-purple-200 bg-purple-50 px-5 py-3 text-sm font-bold text-purple-700"
              >
                تصنيفات المجلات
              </Link>

              <Link
                href="/dashboard"
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700"
              >
                لوحة التحكم
              </Link>
            </div>
          </div>
        </header>

        <section className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-500">إجمالي القائمة</p>
            <p className="mt-2 text-3xl font-black text-slate-900">
              {iraqiJournals.length}
            </p>
          </div>

          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <p className="text-sm font-bold text-emerald-700">
              مجلات مصنفة
            </p>
            <p className="mt-2 text-3xl font-black text-emerald-800">
              {classifiedCount}
            </p>
          </div>

          <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <p className="text-sm font-bold text-blue-700">مجلات محلية</p>
            <p className="mt-2 text-3xl font-black text-blue-800">
              {localCount}
            </p>
          </div>

          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <p className="text-sm font-bold text-amber-700">تحتاج تحقق</p>
            <p className="mt-2 text-3xl font-black text-amber-800">
              {needsCheckCount}
            </p>
          </div>
        </section>

        <section className="mb-6 rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <h2 className="text-xl font-black text-slate-900">
            كيف تستخدم هذه الصفحة؟
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            هذه الصفحة لا تعطي حكماً نهائياً على كل مجلة. الهدف منها تنظيم
            المجلات العراقية وتوجيه الباحث إلى التحقق الصحيح. اعتمد على IASJ
            للعثور على المجلة محلياً، ثم استخدم SCImago/Scopus للتحقق من الربع
            إذا كانت المجلة مفهرسة عالمياً.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="https://iasj.rdd.edu.iq/journals/"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white"
            >
              فتح IASJ
            </a>

            <a
              href="https://www.scimagojr.com/journalrank.php"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700"
            >
              فتح SCImago
            </a>
          </div>
        </section>

        <section className="mb-6 grid gap-4 lg:grid-cols-3">
          {journalNews.map((item) => (
            <article
              key={item.title}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                {item.tag}
              </span>
              <h3 className="mt-4 text-lg font-black text-slate-900">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {item.description}
              </p>
            </article>
          ))}
        </section>

        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-bold text-slate-500">
                Iraqi Journal Watchlist
              </p>
              <h2 className="text-2xl font-black text-slate-900">
                قائمة متابعة المجلات العراقية
              </h2>
            </div>

            <p className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600">
              البيانات تُقرأ من data/iraqi-journals.json
            </p>
          </div>

          <div className="grid gap-4">
            {iraqiJournals.map((journal) => (
              <article
                key={journal.name}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-xl font-black text-slate-900">
                      {journal.name}
                    </h3>
                    <p className="mt-2 text-sm font-bold text-slate-600">
                      {journal.publisher}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {journal.note}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <span
                      className={`rounded-full border px-4 py-2 text-xs font-black ${getStatusClass(
                        journal.status
                      )}`}
                    >
                      {journal.status}
                    </span>
                    <span
                      className={`rounded-full px-4 py-2 text-xs font-black ${getQuartileClass(
                        journal.quartile
                      )}`}
                    >
                      {journal.quartile}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
                  <p>
                    <span className="font-black text-slate-900">التخصص:</span>{" "}
                    {journal.field}
                  </p>
                  <p>
                    <span className="font-black text-slate-900">الفهرسة:</span>{" "}
                    {journal.indexing}
                  </p>
                  <p>
                    <span className="font-black text-slate-900">الحالة:</span>{" "}
                    {journal.status}
                  </p>
                </div>

                {journal.url && (
                  <div className="mt-4">
                    <a
                      href={journal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700"
                    >
                      فتح الرابط
                    </a>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <h2 className="text-xl font-black text-red-900">
            تنبيهات مهمة للباحثين
          </h2>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {alerts.map((alert) => (
              <div
                key={alert}
                className="rounded-2xl border border-red-100 bg-white p-4 text-sm font-bold leading-7 text-red-800"
              >
                {alert}
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}