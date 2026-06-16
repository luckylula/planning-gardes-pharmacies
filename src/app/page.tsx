import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let years: Awaited<ReturnType<typeof prisma.yearConfig.findMany>> = [];
  try {
    years = await prisma.yearConfig.findMany({ orderBy: { year: "desc" } });
  } catch {
    years = [];
  }

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          Planning Gardes Pharmacies — Secteur Albertville
        </h1>
        <p className="mt-2 text-gray-600">
          Générez et gérez le planning annuel de gardes pour les 20 pharmacies
          du secteur.
        </p>
      </header>

      <div className="mb-8 flex flex-wrap gap-3">
        <Link
          href="/generate"
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700"
        >
          Générer une nouvelle année
        </Link>
        <Link
          href="/import"
          className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
        >
          Importer un planning Excel existant
        </Link>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <h2 className="border-b border-gray-100 px-5 py-4 text-lg font-semibold">
          Années enregistrées
        </h2>
        {years.length === 0 ? (
          <p className="px-5 py-8 text-center text-gray-500">
            Aucune année enregistrée. Importez un fichier Excel 2026 ou
            générez une nouvelle année.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {years.map((y) => (
              <li
                key={y.year}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div>
                  <span className="text-lg font-bold">{y.year}</span>
                  <span className="ml-3 text-sm">
                    {y.generated ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-800">
                        Généré
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                        Non généré
                      </span>
                    )}
                  </span>
                </div>
                <Link
                  href={`/planning/${y.year}`}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  Voir le planning →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h3 className="font-semibold text-blue-900">Centre Albertville</h3>
          <p className="mt-1 text-sm text-blue-800">
            8 pharmacies — week-ends et jours fériés
          </p>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <h3 className="font-semibold text-yellow-900">Maurienne</h3>
          <p className="mt-1 text-sm text-yellow-800">
            2 pharmacies — lundis en alternance
          </p>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <h3 className="font-semibold text-green-900">Extérieures</h3>
          <p className="mt-1 text-sm text-green-800">
            10 pharmacies — mardi au vendredi
          </p>
        </div>
      </section>
    </div>
  );
}
