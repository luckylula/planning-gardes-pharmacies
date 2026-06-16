"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PlanningTable, { type PlanningDayRow } from "@/components/PlanningTable";
import StatsPanel from "@/components/StatsPanel";
import ExportButton from "@/components/ExportButton";
import { computeStats } from "@/lib/excel";
import type { PharmacyStats } from "@/lib/types";

export default function PlanningPage({
  params,
}: {
  params: { year: string };
}) {
  const year = parseInt(params.year, 10);
  const router = useRouter();
  const [days, setDays] = useState<PlanningDayRow[]>([]);
  const [stats, setStats] = useState<PharmacyStats[]>([]);
  const [markedDone, setMarkedDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/planning/${year}`);
    const data = await res.json();
    const rows: PlanningDayRow[] = (data.days ?? []).map(
      (d: {
        id: number;
        date: string;
        date_fin: string;
        pharmacie: string;
        adresse: string;
        type: string;
        modified: boolean;
      }) => ({
        id: d.id,
        date: d.date,
        date_fin: d.date_fin,
        pharmacie: d.pharmacie,
        adresse: d.adresse,
        type: d.type,
        modified: d.modified,
      })
    );
    setDays(rows);
    setMarkedDone(data.config?.generated ?? false);
    setStats(
      computeStats(
        rows.map((r) => ({
          year,
          date: new Date(r.date),
          heure_debut: "19h15",
          date_fin: new Date(r.date_fin),
          heure_fin: "19h15",
          pharmacie: r.pharmacie,
          adresse: r.adresse,
          type: r.type as "ferie" | "weekend" | "lundi" | "semaine" | "vide",
        }))
      )
    );
    setLoading(false);
  }, [year]);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpdateDay = async (
    id: number,
    pharmacie: string,
    adresse: string,
  ) => {
    await fetch(`/api/planning/${year}/day/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pharmacie, adresse }),
    });
    await load();
  };

  const handleFinalize = async () => {
    await fetch(`/api/planning/${year}/finalize`, { method: "POST" });
    setMarkedDone(true);
  };

  const handleReset = async () => {
    if (
      !confirm(
        "Réinitialiser cette année ? Toutes les lignes seront supprimées."
      )
    )
      return;
    setResetting(true);
    await fetch(`/api/planning/${year}`, { method: "DELETE" });
    setResetting(false);
    router.push("/generate");
  };

  if (loading) {
    return <p className="text-center text-gray-500">Chargement...</p>;
  }

  if (days.length === 0) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold">Planning {year}</h1>
        <p className="mt-4 text-gray-500">Aucune donnée pour cette année.</p>
        <a
          href="/generate"
          className="mt-4 inline-block text-blue-600 hover:underline"
        >
          Générer le planning →
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Planning {year}</h1>
          <p className="text-sm text-gray-500">
            {days.length} lignes
            {markedDone && (
              <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-blue-800">
                Finalisé
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButton year={year} />
          {!markedDone && (
            <button
              type="button"
              onClick={handleFinalize}
              className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100"
            >
              Marquer comme finalisé
            </button>
          )}
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting}
            className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
          >
            Réinitialiser l&apos;année
          </button>
        </div>
      </div>

      <div className="mb-8">
        <StatsPanel stats={stats} />
      </div>

      <PlanningTable days={days} onUpdateDay={handleUpdateDay} />
    </div>
  );
}
