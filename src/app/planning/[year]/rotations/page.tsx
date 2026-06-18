"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import RotationsPanel from "@/components/RotationsPanel";
import type { YearRotations } from "@/lib/rotations";

export default function RotationsPage({
  params,
}: {
  params: { year: string };
}) {
  const year = parseInt(params.year, 10);
  const [rotations, setRotations] = useState<YearRotations | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/planning/${year}/rotations`)
      .then((r) => r.json())
      .then((data) => {
        setRotations(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [year]);

  if (loading) {
    return <p className="text-center text-gray-500">Chargement...</p>;
  }

  if (!rotations) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold">Rotations {year}</h1>
        <p className="mt-4 text-gray-500">Données indisponibles.</p>
        <Link
          href={`/planning/${year}`}
          className="mt-4 inline-block text-blue-600 hover:underline"
        >
          ← Retour au planning
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Rotations {year}</h1>
          <p className="text-sm text-gray-500">
            Ordre des rotations pour vérifier la continuité avec l&apos;année
            suivante
          </p>
        </div>
        <Link
          href={`/planning/${year}`}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          ← Planning {year}
        </Link>
      </div>

      <RotationsPanel rotations={rotations} />
    </div>
  );
}
