"use client";

import { useMemo, useState } from "react";
import { getDayNameFR, getMonthNameFR } from "@/lib/dates";
import DayEditModal, { type PlanningDayRow } from "./DayEditModal";

export type { PlanningDayRow };

const typeStyles: Record<string, string> = {
  weekend: "bg-blue-100 text-blue-900",
  ferie: "bg-orange-100 text-orange-900",
  lundi: "bg-yellow-100 text-yellow-900",
  semaine: "bg-green-100 text-green-900",
  vide: "bg-gray-100 text-gray-500",
};

const typeLabels: Record<string, string> = {
  weekend: "Week-end",
  ferie: "Férié",
  lundi: "Lundi",
  semaine: "Semaine",
  vide: "Dimanche",
};

interface PlanningTableProps {
  days: PlanningDayRow[];
  onUpdateDay: (
    id: number,
    pharmacie: string,
    adresse: string,
    note: string
  ) => Promise<void>;
}

export default function PlanningTable({
  days,
  onUpdateDay,
}: PlanningTableProps) {
  const [month, setMonth] = useState<number | "all">("all");
  const [editing, setEditing] = useState<PlanningDayRow | null>(null);

  const filtered = useMemo(() => {
    if (month === "all") return days;
    return days.filter((d) => new Date(d.date).getMonth() === month);
  }, [days, month]);

  const months = useMemo(() => {
    const set = new Set(days.map((d) => new Date(d.date).getMonth()));
    return Array.from(set).sort((a, b) => a - b);
  }, [days]);

  const handleSave = async (
    id: number,
    pharmacie: string,
    adresse: string,
    note: string
  ) => {
    await onUpdateDay(id, pharmacie, adresse, note);
    setEditing(null);
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Filtrer par mois :</label>
        <select
          value={month}
          onChange={(e) =>
            setMonth(e.target.value === "all" ? "all" : parseInt(e.target.value, 10))
          }
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="all">Tous les mois</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {getMonthNameFR(m)}
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-500">{filtered.length} lignes</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left font-semibold text-gray-600">
                Date
              </th>
              <th className="hidden px-3 py-3 text-left font-semibold text-gray-600 sm:table-cell">
                Jour
              </th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600">
                Pharmacie
              </th>
              <th className="hidden px-3 py-3 text-left font-semibold text-gray-600 md:table-cell">
                Type
              </th>
              <th className="px-3 py-3 text-right font-semibold text-gray-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filtered.map((day) => {
              const d = new Date(day.date);
              return (
                <tr
                  key={day.id}
                  className={`${typeStyles[day.type] ?? ""} ${day.modified ? "ring-1 ring-inset ring-purple-300" : ""}`}
                >
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {d.toLocaleDateString("fr-FR")}
                    {day.modified && (
                      <span className="ml-1 text-xs text-purple-600">*</span>
                    )}
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-2.5 sm:table-cell">
                    {getDayNameFR(d)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="line-clamp-2">
                      {day.pharmacie || "—"}
                    </span>
                  </td>
                  <td className="hidden px-3 py-2.5 md:table-cell">
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium">
                      {typeLabels[day.type] ?? day.type}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(day)}
                      className="rounded-md bg-white/80 px-2 py-1 text-xs font-medium shadow-sm hover:bg-white"
                    >
                      Modifier
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

        {editing && (
        <DayEditModal
          key={editing.id}
          day={editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </>
  );
}
