"use client";

import type { CategoryStats, PharmacyStats } from "@/lib/types";

interface StatsPanelProps {
  stats: PharmacyStats[];
}

const groupOrder = ["centre", "maurienne", "exterieures"] as const;

const groupTitles: Record<string, string> = {
  centre: "Centre Albertville",
  maurienne: "Maurienne",
  exterieures: "Extérieures",
};

function shortName(name: string) {
  return name.replace(/^Pharmacie (de la |du |de |d'|Des? )?/i, "");
}

function formatGardesCount(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function formatCategory(s: CategoryStats): string {
  if (s.turnos === 0) return "—";
  const tourLabel = s.turnos === 1 ? "tour" : "tours";
  return `${s.turnos} ${tourLabel} · ${formatGardesCount(s.gardesJour)}j · ${formatGardesCount(s.gardesNuit)}n`;
}

function centreTotals(s: PharmacyStats) {
  return {
    jour: s.ferie.gardesJour + s.weekend.gardesJour,
    nuit: s.ferie.gardesNuit + s.weekend.gardesNuit,
  };
}

export default function StatsPanel({ stats }: StatsPanelProps) {
  const totalTurnos = stats.reduce((sum, x) => sum + x.totalTurnos, 0);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-gray-700">
        Gardes par pharmacie ({totalTurnos}{" "}
        {totalTurnos === 1 ? "tour" : "tours"} au total, dimanches exclus)
      </h3>

      <div className="mb-3 flex flex-wrap gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-orange-200" />
          Fériés
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-blue-200" />
          Week-ends
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-yellow-200" />
          Lundis
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-green-200" />
          Semaine
        </span>
      </div>

      {groupOrder.map((group) => {
        const rows = stats.filter((s) => s.group === group);
        if (rows.length === 0) return null;

        return (
          <div key={group} className="mb-6 last:mb-0">
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
              {groupTitles[group]}
            </h4>
            <div className="overflow-x-auto">
              {group === "centre" && (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                      <th className="px-2 py-2 font-semibold">Pharmacie</th>
                      <th className="px-2 py-2 text-center font-semibold text-orange-700">
                        Fériés
                      </th>
                      <th className="px-2 py-2 text-center font-semibold text-blue-700">
                        Week-ends
                      </th>
                      <th className="px-2 py-2 text-center font-semibold text-gray-700">
                        Total Jour
                      </th>
                      <th className="px-2 py-2 text-center font-semibold text-gray-700">
                        Total Nuit
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((s) => {
                      const totals = centreTotals(s);
                      return (
                        <tr
                          key={s.name}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >
                          <td className="px-2 py-2" title={s.name}>
                            {shortName(s.name)}
                          </td>
                          <td className="px-2 py-2 text-center tabular-nums text-orange-800">
                            {formatCategory(s.ferie)}
                          </td>
                          <td className="px-2 py-2 text-center tabular-nums text-blue-800">
                            {formatCategory(s.weekend)}
                          </td>
                          <td className="px-2 py-2 text-center font-medium tabular-nums">
                            {totals.jour ? formatGardesCount(totals.jour) : "—"}
                          </td>
                          <td className="px-2 py-2 text-center font-medium tabular-nums">
                            {totals.nuit ? formatGardesCount(totals.nuit) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {group === "maurienne" && (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                      <th className="px-2 py-2 font-semibold">Pharmacie</th>
                      <th className="px-2 py-2 text-center font-semibold text-yellow-700">
                        Lundis
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((s) => (
                      <tr
                        key={s.name}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="px-2 py-2" title={s.name}>
                          {shortName(s.name)}
                        </td>
                        <td className="px-2 py-2 text-center tabular-nums text-yellow-800">
                          {formatCategory(s.lundi)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {group === "exterieures" && (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                      <th className="px-2 py-2 font-semibold">Pharmacie</th>
                      <th className="px-2 py-2 text-center font-semibold text-green-700">
                        Semaine
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((s) => (
                      <tr
                        key={s.name}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="px-2 py-2" title={s.name}>
                          {shortName(s.name)}
                        </td>
                        <td className="px-2 py-2 text-center tabular-nums text-green-800">
                          {formatCategory(s.semaine)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
