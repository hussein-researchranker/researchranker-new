"use client";

import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/components/layout/AppHeader";

type Node = {
  id: string;
  title: string;
  year: number | null;
  citedByCount: number;
  doi?: string;
  journal?: string;
  relation: string;
};

type Edge = { source: string; target: string; relation: string };

type GraphData = { nodes: Node[]; edges: Edge[]; generatedAt?: string; source?: string };

function truncate(value: string, max = 64) {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function relationLabel(value: string) {
  if (value === "center") return "الورقة الأساسية";
  if (value === "related") return "مشابهة";
  if (value === "reference") return "مرجع مستخدم";
  if (value === "cited-by") return "استشهدت بها";
  return value;
}

export default function GraphPage() {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Node | null>(null);

  useEffect(() => {
    const doi = new URLSearchParams(window.location.search).get("doi") || "";
    if (!doi) {
      setError("لم يتم تحديد DOI لبناء الخريطة.");
      setLoading(false);
      return;
    }

    fetch(`/api/graph?doi=${encodeURIComponent(doi)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error || "تعذر بناء الخريطة.");
        setData(body);
        setSelected(body?.nodes?.find((node: Node) => node.relation === "center") || body?.nodes?.[0] || null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "تعذر بناء الخريطة."))
      .finally(() => setLoading(false));
  }, []);

  const positioned = useMemo(() => {
    if (!data?.nodes?.length) return [] as Array<Node & { x: number; y: number }>;
    const center = data.nodes.find((node) => node.relation === "center") || data.nodes[0];
    const others = data.nodes.filter((node) => node.id !== center.id);
    const radius = 250;
    return [
      { ...center, x: 400, y: 300 },
      ...others.map((node, index) => {
        const angle = (Math.PI * 2 * index) / Math.max(others.length, 1) - Math.PI / 2;
        const ring = radius + (index % 3) * 18;
        return { ...node, x: 400 + Math.cos(angle) * ring, y: 300 + Math.sin(angle) * ring };
      }),
    ];
  }, [data]);

  const byId = useMemo(() => new Map(positioned.map((node) => [node.id, node])), [positioned]);

  return (
    <div className="min-h-screen bg-[#f6f8fb]" dir="rtl">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black tracking-[0.14em] text-blue-700">PAPER RELATIONSHIP GRAPH</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">خريطة علاقات الورقة العلمية</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">تعرض أوراقًا مشابهة، مراجع مستخدمة، وأوراقًا استشهدت بالورقة الأساسية. العلاقات مبنية على بيانات OpenAlex وليست حكمًا على جودة الأدلة.</p>
        </section>

        {loading ? <div className="mt-6 h-[620px] animate-pulse rounded-3xl border border-slate-200 bg-white" /> : null}
        {error ? <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}

        {!loading && data ? (
          <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_320px]">
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <svg viewBox="0 0 800 600" className="min-h-[620px] min-w-[800px] w-full" role="img" aria-label="Paper relationship graph">
                  <defs>
                    <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
                      <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.12" />
                    </filter>
                  </defs>
                  {(data.edges || []).map((edge, index) => {
                    const source = byId.get(edge.source);
                    const target = byId.get(edge.target);
                    if (!source || !target) return null;
                    return <line key={`${edge.source}-${edge.target}-${index}`} x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke="#cbd5e1" strokeWidth="1.5" />;
                  })}
                  {positioned.map((node) => {
                    const center = node.relation === "center";
                    const fill = center ? "#0f172a" : node.relation === "cited-by" ? "#dbeafe" : node.relation === "reference" ? "#fef3c7" : "#dcfce7";
                    const text = center ? "#ffffff" : "#0f172a";
                    return (
                      <g key={node.id} transform={`translate(${node.x}, ${node.y})`} onClick={() => setSelected(node)} className="cursor-pointer" filter="url(#shadow)">
                        <circle r={center ? 48 : 36} fill={fill} stroke={selected?.id === node.id ? "#2563eb" : "#cbd5e1"} strokeWidth={selected?.id === node.id ? 4 : 1.5} />
                        <text textAnchor="middle" dominantBaseline="middle" fill={text} fontSize={center ? 13 : 11} fontWeight="800">{node.year || "—"}</text>
                        <text textAnchor="middle" y={center ? 68 : 54} fill="#334155" fontSize="10" fontWeight="700">{relationLabel(node.relation)}</text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </section>

            <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black">تفاصيل العقدة</h2>
              {selected ? (
                <div className="mt-4">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{relationLabel(selected.relation)}</span>
                  <h3 className="mt-3 text-base font-black leading-7 text-slate-950">{selected.title}</h3>
                  <p className="mt-3 text-xs leading-6 text-slate-500">{selected.journal || "مجلة غير محددة"} • {selected.year || "سنة غير متاحة"}</p>
                  <p className="mt-2 text-xs font-bold text-blue-700">الاستشهادات: {selected.citedByCount}</p>
                  {selected.doi ? <a href={`https://doi.org/${selected.doi}`} target="_blank" rel="noreferrer" className="mt-4 block rounded-xl bg-blue-600 px-4 py-3 text-center text-xs font-black text-white">فتح DOI</a> : null}
                </div>
              ) : <p className="mt-4 text-sm text-slate-500">اختر عقدة من الخريطة.</p>}
              <div className="mt-6 border-t border-slate-100 pt-4 text-xs leading-6 text-slate-500">
                <p><strong>المصدر:</strong> {data.source || "OpenAlex"}</p>
                <p><strong>العقد:</strong> {data.nodes.length}</p>
                <p><strong>العلاقات:</strong> {data.edges.length}</p>
              </div>
            </aside>
          </div>
        ) : null}
      </main>
    </div>
  );
}
