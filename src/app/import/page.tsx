"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ImportSummary } from "@/lib/types";

export default function ImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [targetYear, setTargetYear] = useState<number | "">("");

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur d'analyse");
      setSummary(data.summary);
      setTargetYear(data.summary.year);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!file || !summary) return;
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("confirm", "true");
      if (targetYear) formData.append("year", String(targetYear));
      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur d'import");
      router.push(`/planning/${data.year}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="mb-2 text-2xl font-bold">Importer un planning Excel</h1>
      <p className="mb-6 text-gray-600">
        Chargez un fichier .xlsx existant (ex. planning 2026) pour détecter
        automatiquement les positions de rotation et servir de base pour
        l&apos;année suivante.
      </p>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <label className="mb-2 block text-sm font-medium">
          Fichier Excel (.xlsx)
        </label>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setSummary(null);
          }}
          className="mb-4 block w-full text-sm"
        />

        {file && !summary && (
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Analyse..." : "Analyser le fichier"}
          </button>
        )}

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {summary && (
          <div className="mt-6 space-y-4">
            <h2 className="text-lg font-semibold">Résumé détecté</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-lg bg-gray-50 p-3">
                <dt className="text-gray-500">Année détectée</dt>
                <dd className="font-semibold">{summary.year}</dd>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <dt className="text-gray-500">Lignes importées</dt>
                <dd className="font-semibold">{summary.totalRows}</dd>
              </div>
              <div className="rounded-lg bg-orange-50 p-3">
                <dt className="text-gray-500">Dernier jour férié</dt>
                <dd className="font-semibold">{summary.lastFeriePharma}</dd>
              </div>
              <div className="rounded-lg bg-blue-50 p-3">
                <dt className="text-gray-500">Dernier dimanche</dt>
                <dd className="font-semibold">{summary.lastDomingoPharma}</dd>
              </div>
              <div className="rounded-lg bg-yellow-50 p-3">
                <dt className="text-gray-500">Dernier lundi Maurienne</dt>
                <dd className="font-semibold">{summary.lastLundiPharma}</dd>
              </div>
              <div className="rounded-lg bg-green-50 p-3">
                <dt className="text-gray-500">Dernière extérieure</dt>
                <dd className="font-semibold">
                  idx {summary.lastSemaineIdx}
                </dd>
              </div>
            </dl>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Année à enregistrer
              </label>
              <input
                type="number"
                value={targetYear}
                onChange={(e) =>
                  setTargetYear(
                    e.target.value ? parseInt(e.target.value, 10) : ""
                  )
                }
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading
                ? "Import en cours..."
                : "Confirmer et sauvegarder comme base"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
