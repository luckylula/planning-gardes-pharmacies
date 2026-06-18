"use client";

import { useState } from "react";
import type { RotationEntry } from "@/lib/rotations";

function shortName(name: string) {
  return name.replace(/^Pharmacie (de la |du |de |d'|Des? )?/i, "");
}

function moveItem<T>(list: T[], from: number, direction: -1 | 1): T[] {
  const to = from + direction;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

function renumber(entries: RotationEntry[]): RotationEntry[] {
  return entries.map((e, i) => ({ ...e, position: i + 1 }));
}

function EditableList({
  title,
  subtitle,
  entries,
  onChange,
  showDetail,
  cardClass,
  badgeClass,
}: {
  title: string;
  subtitle: string;
  entries: RotationEntry[];
  onChange: (entries: RotationEntry[]) => void;
  showDetail?: boolean;
  cardClass: string;
  badgeClass: string;
}) {
  const move = (index: number, direction: -1 | 1) => {
    onChange(renumber(moveItem(entries, index, direction)));
  };

  return (
    <section className={`rounded-xl border p-4 shadow-sm ${cardClass}`}>
      <div className="mb-3">
        <h2 className="text-sm font-bold text-gray-800">{title}</h2>
        <p className="text-xs text-gray-600">{subtitle}</p>
      </div>
      <ol className="space-y-1">
        {entries.map((e, index) => (
          <li
            key={`${e.name}-${index}`}
            className="flex items-center gap-2 text-sm text-gray-800"
          >
            <span
              className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${badgeClass}`}
            >
              {e.position}
            </span>
            <span className="min-w-0 flex-1 truncate" title={e.name}>
              {shortName(e.name)}
            </span>
            {showDetail && e.detail && (
              <span className="shrink-0 text-xs text-gray-500">{e.detail}</span>
            )}
            <div className="flex shrink-0 gap-0.5">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                className="rounded border border-gray-300 px-1.5 py-0.5 text-xs disabled:opacity-30"
                aria-label="Monter"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === entries.length - 1}
                className="rounded border border-gray-300 px-1.5 py-0.5 text-xs disabled:opacity-30"
                aria-label="Descendre"
              >
                ↓
              </button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function RotationOrderEditor({
  initialRotations,
  oldestYear,
}: {
  oldestYear: number;
  initialRotations: {
    ferie: RotationEntry[];
    domingo: RotationEntry[];
    lundi: RotationEntry[];
    semaine: RotationEntry[];
  };
}) {
  const [ferie, setFerie] = useState(initialRotations.ferie);
  const [domingo, setDomingo] = useState(initialRotations.domingo);
  const [lundi, setLundi] = useState(initialRotations.lundi);
  const [semaine, setSemaine] = useState(initialRotations.semaine);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/configuration/rotations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rotations: {
            year: oldestYear,
            ferie,
            domingo,
            lundi,
            semaine,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur lors de l'enregistrement");
        return;
      }
      setMessage(data.message ?? "Ordre enregistré.");
    } catch {
      setError("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Vous modifiez l&apos;ordre de référence de l&apos;année{" "}
        <strong>{oldestYear}</strong>. Ce changement affecte la continuité pour
        toutes les années suivantes. Pensez à régénérer les plannings postérieurs
        si nécessaire.
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <EditableList
          title="Rotation Fériés"
          subtitle="8 pharmacies — Centre Albertville"
          entries={ferie}
          onChange={setFerie}
          cardClass="border-blue-200 bg-blue-50"
          badgeClass="bg-blue-200 text-blue-900"
        />
        <EditableList
          title="Rotation Dimanches"
          subtitle="8 pharmacies — Centre Albertville"
          entries={domingo}
          onChange={setDomingo}
          cardClass="border-blue-200 bg-blue-50"
          badgeClass="bg-blue-200 text-blue-900"
        />
        <EditableList
          title="Rotation Lundis"
          subtitle="Maurienne — 2 pharmacies"
          entries={lundi}
          onChange={setLundi}
          cardClass="border-yellow-200 bg-yellow-50"
          badgeClass="bg-yellow-200 text-yellow-900"
        />
        <EditableList
          title="Rotation Semaine"
          subtitle="Extérieures — cycle de 18 tours"
          entries={semaine}
          onChange={setSemaine}
          showDetail
          cardClass="border-green-200 bg-green-50"
          badgeClass="bg-green-200 text-green-900"
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "Enregistrement…" : "Enregistrer l'ordre"}
        </button>
        {message && <p className="text-sm text-green-700">{message}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
