"use client";

import { useEffect } from "react";
import ExportButton from "@/components/ExportButton";

export default function ExportPage({
  params,
}: {
  params: { year: string };
}) {
  const year = parseInt(params.year, 10);

  useEffect(() => {
    window.location.href = `/api/planning/${year}/export`;
  }, [year]);

  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold">Export Planning {year}</h1>
      <p className="mt-4 text-gray-600">
        Le téléchargement devrait démarrer automatiquement.
      </p>
      <div className="mt-6">
        <ExportButton year={year} label="Télécharger à nouveau" />
      </div>
      <a
        href={`/planning/${year}`}
        className="mt-4 inline-block text-sm text-blue-600 hover:underline"
      >
        ← Retour au planning
      </a>
    </div>
  );
}
