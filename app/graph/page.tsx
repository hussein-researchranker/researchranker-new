"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import { useLocale } from "@/components/i18n/LocaleProvider";

type Node = {
  id: string;
  title: string;
  year?: number;
  doi?: string;
  citedByCount?: number;
  authors?: string;
  journal?: string;
  type: "center" | "reference" | "citing" | "related";
};
type Edge = {
  source: string;
  target: string;
  kind: "references" | "cited-by" | "related";
};
type Network = {
  center: Node;
  nodes: Node[];
  edges: Edge[];
  source: string;
  checkedAt: string;
};

function point(index: number, count: number, radius: number, centerX = 400, centerY = 310) {
  const angle = (Math.PI * 2 * index) / Math.max(1, count) - Math.PI / 2;
  return {
    x: centerX + Math.cos(angle) * radius,
    y: centerY + Math.sin(angle) * radius,
  };
}

export default function GraphPage() {
  const { isArabic } = useLocale();
  const [network, setNetwork] = useState<Network | null>(null);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Node | null>(null);

  useEffect(() => {
    async function load() {
      const doi = new URLSearchParams(window.location.search).get("doi") || "";
      if (!doi) {
        setMessage(isArabic ? "افتح الخريطة من ورقة لديها DOI." : "Open the graph from a paper with a DOI.");
        return;
      }
      const response = await fetch(`/api/article/network?doi=${encodeURIComponent(doi)}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (response.ok) {
        setNetwork(data);
        setSelected(data.center);
      } else {
        setMessage(data?.error || (isArabic ? "تعذر إنشاء شبكة العلاقات." : "Unable to build the relationship graph."));
      }
    }
    load();
  }, [isArabic]);

  const layout = useMemo(() => {
    if (!network) return new Map<string, { x: number; y: number }>();
    const map = new Map<string, { x: number; y: number }>();
    map.set(network.center.id, { x: 400, y: 310 });
    const groups = {
      reference: network.nodes.filter((node) => node.type === "reference"),
      citing: network.nodes.filter((node) => node.type === "citing"),
      related: network.nodes.filter((node) => node.type === "related"),
    };
    groups.reference.forEach((node, index) =>
      map.set(node.id, point(index, groups.reference.length, 205))
    );
    groups.citing.forEach((node, index) =>
      map.set(node.id, point(index, groups.citing.length, 285))
    );
    groups.related.forEach((node, index) =>
      map.set(node.id, point(index, groups.related.length, 130))
    );
    return map;
  }, [network]);

  const timeline = useMemo(() => {
    if (!network) return [] as Array<{ year: number; count: number }>;
    const counts = new Map<number, number>();
    network.nodes.forEach((node) => {
      if (!node.year) return;
      counts.set(node.year, (counts.get(node.year) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => a.year - b.year);
  }, [network]);

  const maxTimeline = Math.max(1, ...timeline.map((entry) => entry.count));

  return (
    <div className="min-h-screen bg-[#f6f8fb]" dir={isArabic ? "rtl" : "ltr"}>
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-[30px] bg-slate-950 p-7 text-white shadow-xl sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
            {isArabic ? "خريطة علاقات الأوراق" : "Paper Relationship Graph"}
          </p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">
            {isArabic
              ? "شاهد الورقة داخل شبكة المراجع والاستشهادات والأعمال ذات العلاقة."
              : "See the paper inside its reference, citation, and related-work network."}
          </h1>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">
            {isArabic
              ? "تُبنى الشبكة من OpenAlex عند توفر المفتاح، وإلا تستخدم OpenCitations مع بيانات Crossref. السنوات والمؤلفون تساعدك على قراءة تطور المجال، لكن الشبكة لا تقيس جودة الدراسة بحد ذاتها."
              : "The network uses OpenAlex when configured, otherwise OpenCitations with Crossref metadata. Publication years and authors help trace the field, but graph position is not a quality score."}
          </p>
        </section>

        {message ? (
          <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-center font-bold text-amber-900">
            {message}
          </div>
        ) : null}

        {network ? (
          <>
            <div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
              <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4 text-[10px] font-black">
                  <Legend label={isArabic ? "الورقة المركزية" : "Center paper"} className="bg-slate-950 text-white" />
                  <Legend label={isArabic ? "المراجع" : "References"} className="bg-blue-100 text-blue-800" />
                  <Legend label={isArabic ? "استشهدت بها" : "Cited by"} className="bg-emerald-100 text-emerald-800" />
                  <Legend label={isArabic ? "ذات علاقة" : "Related"} className="bg-violet-100 text-violet-800" />
                </div>
                <div className="overflow-x-auto">
                  <svg
                    viewBox="0 0 800 620"
                    className="min-h-[560px] min-w-[760px] w-full bg-[radial-gradient(circle_at_center,#f8fafc,#fff)]"
                    role="img"
                    aria-label={isArabic ? "شبكة علاقات ورقة علمية" : "Paper relationship network"}
                  >
                    {network.edges.map((edge, index) => {
                      const from = layout.get(edge.source);
                      const to = layout.get(edge.target);
                      if (!from || !to) return null;
                      return (
                        <line
                          key={`${edge.source}-${edge.target}-${index}`}
                          x1={from.x}
                          y1={from.y}
                          x2={to.x}
                          y2={to.y}
                          stroke={
                            edge.kind === "cited-by"
                              ? "#10b981"
                              : edge.kind === "related"
                                ? "#8b5cf6"
                                : "#3b82f6"
                          }
                          strokeWidth="1.8"
                          strokeOpacity="0.45"
                        />
                      );
                    })}
                    {network.nodes.map((node) => {
                      const p = layout.get(node.id);
                      if (!p) return null;
                      const radius = node.type === "center" ? 34 : 22;
                      const fill =
                        node.type === "center"
                          ? "#0f172a"
                          : node.type === "reference"
                            ? "#dbeafe"
                            : node.type === "citing"
                              ? "#d1fae5"
                              : "#ede9fe";
                      const stroke =
                        node.type === "center"
                          ? "#0f172a"
                          : node.type === "reference"
                            ? "#2563eb"
                            : node.type === "citing"
                              ? "#059669"
                              : "#7c3aed";
                      return (
                        <g key={node.id} onClick={() => setSelected(node)} className="cursor-pointer">
                          <circle cx={p.x} cy={p.y} r={radius} fill={fill} stroke={stroke} strokeWidth="2" />
                          <text
                            x={p.x}
                            y={p.y + 4}
                            textAnchor="middle"
                            fontSize={node.type === "center" ? "13" : "10"}
                            fontWeight="800"
                            fill={node.type === "center" ? "white" : stroke}
                          >
                            {node.year || "•"}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </section>

              <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wider text-violet-700">
                  {isArabic ? "العقدة المختارة" : "Selected node"}
                </p>
                {selected ? (
                  <>
                    <span className="mt-4 inline-flex rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase text-slate-600">
                      {selected.type}
                    </span>
                    <h2 className="mt-3 text-xl font-black leading-8 text-slate-950">{selected.title}</h2>
                    {selected.authors ? (
                      <p className="mt-2 text-xs leading-6 text-slate-500">{selected.authors}</p>
                    ) : null}
                    <dl className="mt-5 space-y-3 text-sm">
                      <Row label={isArabic ? "السنة" : "Year"} value={String(selected.year || "—")} />
                      <Row label={isArabic ? "المجلة" : "Journal"} value={selected.journal || "—"} />
                      <Row label={isArabic ? "الاستشهادات" : "Cited by"} value={String(selected.citedByCount || 0)} />
                      <Row label="DOI" value={selected.doi || "—"} />
                    </dl>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {selected.doi ? (
                        <Link
                          href={`/article?doi=${encodeURIComponent(selected.doi)}`}
                          className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white"
                        >
                          {isArabic ? "تفاصيل الورقة" : "Article details"}
                        </Link>
                      ) : null}
                      {selected.id.startsWith("W") ? (
                        <a
                          href={`https://openalex.org/${selected.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-black"
                        >
                          OpenAlex
                        </a>
                      ) : selected.doi ? (
                        <a
                          href={`https://doi.org/${selected.doi}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-black"
                        >
                          DOI
                        </a>
                      ) : null}
                    </div>
                  </>
                ) : null}

                <div className="mt-6 border-t border-slate-100 pt-5">
                  <h3 className="text-sm font-black">
                    {isArabic ? "ملخص الشبكة" : "Network summary"}
                  </h3>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Mini label={isArabic ? "مراجع" : "References"} value={network.nodes.filter((n) => n.type === "reference").length} />
                    <Mini label={isArabic ? "استشهدت بها" : "Cited by"} value={network.nodes.filter((n) => n.type === "citing").length} />
                    <Mini label={isArabic ? "ذات علاقة" : "Related"} value={network.nodes.filter((n) => n.type === "related").length} />
                  </div>
                  <p className="mt-4 text-xs leading-6 text-slate-500">
                    {isArabic ? "المصدر" : "Source"}: {network.source}. {isArabic ? "تُحد العقد للمحافظة على سرعة ووضوح الرسم." : "Node counts are bounded to keep the graph fast and readable."}
                  </p>
                </div>
              </aside>
            </div>

            <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-blue-700">
                  {isArabic ? "الخط الزمني" : "Timeline"}
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-950">
                  {isArabic ? "توزيع الأوراق الظاهرة حسب سنة النشر" : "Visible papers by publication year"}
                </h2>
              </div>
              {timeline.length ? (
                <div className="mt-6 flex min-h-44 items-end gap-2 overflow-x-auto pb-2">
                  {timeline.map((entry) => (
                    <div key={entry.year} className="flex min-w-12 flex-col items-center justify-end gap-2">
                      <span className="text-[10px] font-black text-slate-500">{entry.count}</span>
                      <div
                        className="w-7 rounded-t-lg bg-gradient-to-t from-blue-600 to-violet-500"
                        style={{ height: `${Math.max(20, (entry.count / maxTimeline) * 120)}px` }}
                        title={`${entry.year}: ${entry.count}`}
                      />
                      <span className="text-[10px] font-bold text-slate-600">{entry.year}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  {isArabic ? "لا تتوفر سنوات كافية لبناء خط زمني." : "Not enough year metadata to build a timeline."}
                </p>
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

function Legend({ label, className }: { label: string; className: string }) {
  return <span className={`rounded-full px-3 py-1.5 ${className}`}>{label}</span>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
      <dt className="font-bold text-slate-500">{label}</dt>
      <dd className="max-w-[65%] break-words text-start font-semibold">{value}</dd>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center">
      <p className="text-[9px] font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}
