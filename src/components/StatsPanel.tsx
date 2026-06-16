"use client";

import type { PharmacyStats } from "@/lib/types";

interface StatsPanelProps {
  stats: PharmacyStats[];
}

const groupColors: Record<string, string> = {
  centre: "bg-blue-50 border-blue-200",
  maurienne: "bg-yellow-50 border-yellow-200",
  exterieures: "bg-green-50 border-green-200",
};

const groupLabels: Record<string, string> = {
  centre: "Centre",
  maurienne: "Maurienne",
  exterieures: "Extérieures",
};

export default function StatsPanel({ stats }: StatsPanelProps) {
  const total = stats.reduce((s, x) => s + x.count, 0);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">
        Gardes par pharmacie ({total} au total)
      </h3>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.name}
            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${groupColors[s.group] ?? "bg-gray-50"}`}
          >
            <span className="truncate pr-2" title={s.name}>
              {s.name.replace("Pharmacie ", "")}
            </span>
            <span className="shrink-0 font-bold tabular-nums">{s.count}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
        {Object.entries(groupLabels).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1">
            <span
              className={`inline-block h-3 w-3 rounded border ${groupColors[k]}`}
            />
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}
