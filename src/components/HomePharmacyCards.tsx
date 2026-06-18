import Link from "next/link";
import type { RotationEntry } from "@/lib/rotations";

function shortName(name: string) {
  return name.replace(/^Pharmacie (de la |du |de |d'|Des? )?/i, "");
}

function RotationList({
  entries,
  showDetail,
}: {
  entries: RotationEntry[];
  showDetail?: boolean;
}) {
  return (
    <ol className="mt-2 space-y-0.5 text-xs">
      {entries.map((e) => (
        <li key={e.position} className="flex gap-1.5 text-gray-800">
          <span className="w-4 shrink-0 font-semibold text-gray-500">
            {e.position}.
          </span>
          <span className="min-w-0 flex-1" title={e.name}>
            {shortName(e.name)}
          </span>
          {showDetail && e.detail && (
            <span className="shrink-0 text-gray-500">{e.detail}</span>
          )}
        </li>
      ))}
    </ol>
  );
}

export default function HomePharmacyCards({
  oldestYear,
  ferie,
  domingo,
  lundi,
  semaine,
}: {
  oldestYear: number | null;
  ferie: RotationEntry[];
  domingo: RotationEntry[];
  lundi: RotationEntry[];
  semaine: RotationEntry[];
}) {
  const hasData = oldestYear != null && ferie.length > 0;

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Ordres de rotation
          </h2>
          {oldestYear && (
            <p className="text-sm text-gray-500">
              Basé sur l&apos;année {oldestYear} (référence la plus ancienne)
            </p>
          )}
        </div>
        {hasData && (
          <Link
            href="/configuration/rotations"
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Modifier l&apos;ordre de rotation
          </Link>
        )}
      </div>

      {!hasData ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-sm text-gray-500">
          Importez ou générez un planning pour afficher les ordres de rotation.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h3 className="font-semibold text-blue-900">Centre Albertville</h3>
            <p className="mt-1 text-xs text-blue-800">
              8 pharmacies — fériés et dimanches
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-blue-700">
              Fériés
            </p>
            <RotationList entries={ferie} />
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-blue-700">
              Dimanches
            </p>
            <RotationList entries={domingo} />
          </div>

          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <h3 className="font-semibold text-yellow-900">Maurienne</h3>
            <p className="mt-1 text-xs text-yellow-800">
              2 pharmacies — lundis en alternance
            </p>
            <RotationList entries={lundi} />
          </div>

          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <h3 className="font-semibold text-green-900">Extérieures</h3>
            <p className="mt-1 text-xs text-green-800">
              Cycle de 18 tours — mardi au vendredi
            </p>
            <RotationList entries={semaine} showDetail />
          </div>
        </div>
      )}
    </section>
  );
}
