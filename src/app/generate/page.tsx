"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import YearSelector from "@/components/YearSelector";
import {
  PHARMACIES_CENTRE,
  PHARMACIES_MAURIENNE,
  getExterieuresCycleSlot,
  ROTATION_EXTERIEURES_CYCLE_LENGTH,
} from "@/lib/pharmacies";

interface GeneratePreview {
  year: number;
  hasPrevious: boolean;
  previousYear?: number;
  defaults: {
    centreStartIdx: number;
    ferieStartIdx: number;
    domingoStartIdx: number;
    lundiNext: "lauziere" | "grand_arc";
    semaineStartIdx: number;
  };
  labels: {
    centreNext: string;
    lundiNext: string;
    semaineNext: string;
  };
}

export default function GeneratePage() {
  const router = useRouter();
  const [year, setYear] = useState(new Date().getFullYear() + 1);
  const [preview, setPreview] = useState<GeneratePreview | null>(null);
  const [config, setConfig] = useState({
    centreStartIdx: 0,
    ferieStartIdx: 0,
    domingoStartIdx: 0,
    lundiNext: "grand_arc" as "lauziere" | "grand_arc",
    semaineStartIdx: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadPreview = useCallback(async () => {
    const res = await fetch(`/api/generate?year=${year}`);
    const data = await res.json();
    setPreview(data);
    setConfig(data.defaults);
  }, [year]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/planning/${year}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur de génération");
      router.push(`/planning/${year}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="mb-2 text-2xl font-bold">Générer une nouvelle année</h1>
      <p className="mb-6 text-gray-600">
        Sélectionnez l&apos;année et vérifiez les paramètres de départ avant
        de lancer la génération automatique.
      </p>

      <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <label className="mb-2 block text-sm font-medium">Année</label>
          <YearSelector value={year} onChange={setYear} />
        </div>

        {preview && (
          <>
            {preview.hasPrevious ? (
              <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                Paramètres détectés depuis l&apos;année {preview.previousYear}
              </p>
            ) : (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                Aucune année précédente trouvée — valeurs par défaut utilisées.
                Importez d&apos;abord un Excel si possible.
              </p>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Rotation Albertville (week-ends + fériés) — prochain :{" "}
                  <span className="text-blue-600">
                    {PHARMACIES_CENTRE[config.centreStartIdx]?.name}
                  </span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={7}
                  value={config.centreStartIdx}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setConfig((c) => ({
                      ...c,
                      centreStartIdx: v,
                      ferieStartIdx: v,
                      domingoStartIdx: v,
                    }));
                  }}
                  className="w-full"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Lundi Maurienne — prochain
                </label>
                <select
                  value={config.lundiNext}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      lundiNext: e.target.value as "lauziere" | "grand_arc",
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="lauziere">
                    {PHARMACIES_MAURIENNE[0].name}
                  </option>
                  <option value="grand_arc">
                    {PHARMACIES_MAURIENNE[1].name}
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Extérieures — prochain :{" "}
                  <span className="text-green-600">
                    {getExterieuresCycleSlot(config.semaineStartIdx).pharma.name}
                  </span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={ROTATION_EXTERIEURES_CYCLE_LENGTH - 1}
                  value={config.semaineStartIdx}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      semaineStartIdx: parseInt(e.target.value, 10),
                    }))
                  }
                  className="w-full"
                />
              </div>
            </div>
          </>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Génération en cours..." : "Générer le planning"}
        </button>
      </div>
    </div>
  );
}
