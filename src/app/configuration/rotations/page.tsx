import Link from "next/link";
import { redirect } from "next/navigation";
import RotationOrderEditor from "@/components/RotationOrderEditor";
import { getBaselineRotations } from "@/lib/rotations";
import { getOldestYear } from "@/lib/years";

export const dynamic = "force-dynamic";

export default async function ConfigurationRotationsPage() {
  const oldestYear = await getOldestYear();
  if (!oldestYear) {
    redirect("/");
  }

  const rotations = await getBaselineRotations(oldestYear);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Ordre des rotations</h1>
          <p className="text-sm text-gray-500">
            Année de référence : <strong>{oldestYear}</strong>
          </p>
        </div>
        <Link
          href="/"
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          ← Accueil
        </Link>
      </div>

      <RotationOrderEditor
        oldestYear={oldestYear}
        initialRotations={{
          ferie: rotations.ferie,
          domingo: rotations.domingo,
          lundi: rotations.lundi,
          semaine: rotations.semaine,
        }}
      />
    </div>
  );
}
