"use client";

import type { RotationEntry, YearRotations } from "@/lib/rotations";

const GROUP_STYLES: Record<
  RotationEntry["group"],
  { card: string; badge: string; title: string }
> = {
  centre: {
    card: "border-blue-200 bg-blue-50",
    badge: "bg-blue-200 text-blue-900",
    title: "Albertville",
  },
  maurienne: {
    card: "border-yellow-200 bg-yellow-50",
    badge: "bg-yellow-200 text-yellow-900",
    title: "Maurienne",
  },
  exterieures: {
    card: "border-green-200 bg-green-50",
    badge: "bg-green-200 text-green-900",
    title: "Extérieures",
  },
};

function shortName(name: string) {
  return name.replace(/^Pharmacie (de la |du |de |d'|Des? )?/i, "");
}

function RotationBlock({
  title,
  subtitle,
  entries,
  showDetail,
}: {
  title: string;
  subtitle: string;
  entries: RotationEntry[];
  showDetail?: boolean;
}) {
  const group = entries[0]?.group ?? "centre";
  const styles = GROUP_STYLES[group];

  return (
    <section
      className={`rounded-xl border p-4 shadow-sm ${styles.card}`}
    >
      <div className="mb-3">
        <h2 className="text-sm font-bold text-gray-800">{title}</h2>
        <p className="text-xs text-gray-600">{subtitle}</p>
      </div>
      <ol className="space-y-1">
        {entries.map((e) => (
          <li
            key={e.position}
            className="flex items-baseline gap-2 text-sm text-gray-800"
          >
            <span
              className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${styles.badge}`}
            >
              {e.position}
            </span>
            <span className="flex-1" title={e.name}>
              {shortName(e.name)}
            </span>
            {showDetail && e.detail && (
              <span className="text-xs text-gray-500">{e.detail}</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function RotationsPanel({ rotations }: { rotations: YearRotations }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <RotationBlock
        title="Rotation Fériés"
        subtitle="8 pharmacies — ordre à partir du 1er férié de l'année"
        entries={rotations.ferie}
      />
      <RotationBlock
        title="Rotation Dimanches"
        subtitle="8 pharmacies — ordre à partir du 1er week-end de l'année"
        entries={rotations.domingo}
      />
      <RotationBlock
        title="Rotation Lundis"
        subtitle="Maurienne — ordre à partir du 1er lundi de l'année"
        entries={rotations.lundi}
      />
      <RotationBlock
        title="Rotation Semaine"
        subtitle="Extérieures — cycle de 18 tours à partir du 1er mardi–vendredi"
        entries={rotations.semaine}
        showDetail
      />
    </div>
  );
}
