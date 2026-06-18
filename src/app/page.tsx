import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db";
import HomePharmacyCards from "@/components/HomePharmacyCards";
import { getBaselineRotations } from "@/lib/rotations";
import { getOldestYear } from "@/lib/years";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  noStore();

  let years: Awaited<ReturnType<typeof prisma.yearConfig.findMany>> = [];
  try {
    years = await prisma.yearConfig.findMany({ orderBy: { year: "desc" } });
  } catch {
    years = [];
  }

  const yearsWithCounts = await Promise.all(
    years.map(async (y) => ({
      ...y,
      dayCount: await prisma.planningDay.count({ where: { year: y.year } }),
    }))
  );

  const oldestYear = await getOldestYear();
  const baseline =
    oldestYear != null ? await getBaselineRotations(oldestYear) : null;

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
            {yearsWithCounts.map((y) => {
              const hasPlanning = y.dayCount > 0;
              return (
              <li
                key={y.year}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div>
                  <span className="text-lg font-bold">{y.year}</span>
                  <span className="ml-3 text-sm">
                    {hasPlanning ? (
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
                  href={hasPlanning ? `/planning/${y.year}` : "/generate"}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  {hasPlanning ? "Voir le planning →" : "Générer →"}
                </Link>
              </li>
            );
            })}
          </ul>
        )}
      </section>

      <HomePharmacyCards
        oldestYear={oldestYear}
        ferie={baseline?.ferie ?? []}
        domingo={baseline?.domingo ?? []}
        lundi={baseline?.lundi ?? []}
        semaine={baseline?.semaine ?? []}
      />
    </div>
  );
}
