"use client";

import AppHeader from "@/components/layout/AppHeader";
import { useLanguage } from "@/components/i18n/LanguageProvider";

const formats = [
  {
    id: "csl-json",
    label: "CSL JSON",
    extension: ".json",
    descriptionAr: "صيغة معيارية قابلة للاستيراد مباشرة إلى Zotero وبرامج تعتمد CSL.",
    descriptionEn: "A standardized format importable by Zotero and CSL-based tools.",
  },
  {
    id: "ris",
    label: "RIS",
    extension: ".ris",
    descriptionAr: "صيغة تبادل شائعة ومتوافقة مع Zotero وEndNote ومديري المراجع الآخرين.",
    descriptionEn: "A widely supported interchange format for Zotero, EndNote, and other reference managers.",
  },
  {
    id: "bibtex",
    label: "BibTeX",
    extension: ".bib",
    descriptionAr: "مناسبة لـLaTeX ويمكن استيرادها أيضًا إلى Zotero.",
    descriptionEn: "Suitable for LaTeX workflows and also importable by Zotero.",
  },
] as const;

export default function LibraryExportPage() {
  const { locale, dir } = useLanguage();
  const ar = locale === "ar";

  return (
    <div className="min-h-screen bg-[#f6f8fb]" dir={dir}>
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-[30px] border border-slate-200 bg-slate-950 p-7 text-white shadow-xl sm:p-10">
          <p className="text-xs font-black tracking-[0.14em] text-blue-300">REFERENCE EXPORT</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            {ar ? "تصدير المكتبة البحثية" : "Export research library"}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
            {ar
              ? "صدّر بيانات مكتبتك بصيغ ببليوغرافية معيارية بدل الاعتماد على CSV فقط. التصدير يتطلب تسجيل الدخول ويقرأ عناصر مكتبتك الخاصة فقط."
              : "Export your private library using standardized bibliographic formats instead of relying on CSV alone. Export requires sign-in and reads only your own library items."}
          </p>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          {formats.map((format) => (
            <article
              key={format.id}
              className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-black text-slate-950">{format.label}</h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-500">
                  {format.extension}
                </span>
              </div>
              <p className="mt-3 flex-1 text-sm leading-7 text-slate-600">
                {ar ? format.descriptionAr : format.descriptionEn}
              </p>
              <a
                href={`/api/library/export?format=${encodeURIComponent(format.id)}`}
                className="mt-5 rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-black text-white hover:bg-blue-700"
              >
                {ar ? `تنزيل ${format.label}` : `Download ${format.label}`}
              </a>
            </article>
          ))}
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">
            {ar ? "ملاحظات التوافق" : "Compatibility notes"}
          </h2>
          <div className="mt-3 space-y-2 text-sm leading-7 text-slate-600">
            <p>
              {ar
                ? "• CSL JSON وRIS وBibTeX صيغ معيارية يدعم Zotero استيرادها."
                : "• Zotero supports importing CSL JSON, RIS, and BibTeX."}
            </p>
            <p>
              {ar
                ? "• هذا التصدير ينقل البيانات الببليوغرافية؛ المجموعات والمرفقات والملاحظات الخاصة بالتطبيق لا تُعامل كنسخة احتياطية كاملة من Zotero."
                : "• This export transfers bibliographic metadata; app collections, attachments, and internal notes are not a full Zotero backup."}
            </p>
            <p>
              {ar
                ? "• يحتفظ ResearchRanker بالمصدر الأصلي قدر الإمكان ولا ينشئ DOI أو PMID غير موجود."
                : "• ResearchRanker preserves source metadata where available and does not invent missing DOI or PMID values."}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
