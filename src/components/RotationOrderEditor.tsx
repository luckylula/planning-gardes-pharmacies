"use client";

import { useState } from "react";
import type { RotationEntry } from "@/lib/rotations";

function shortName(name: string) {
  return name.replace(/^Pharmacie (de la |du |de |d'|Des? )?/i, "");
}

function reorderList<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return list;
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
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
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
    setOverIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedIndex !== null && index !== overIndex) {
      setOverIndex(index);
    }
  };

  const handleDrop = (index: number) => {
    if (draggedIndex === null) return;
    onChange(renumber(reorderList(entries, draggedIndex, index)));
    setDraggedIndex(null);
    setOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setOverIndex(null);
  };

  return (
    <section className={`rounded-xl border p-4 shadow-sm ${cardClass}`}>
      <div className="mb-3">
        <h2 className="text-sm font-bold text-gray-800">{title}</h2>
        <p className="text-xs text-gray-600">{subtitle}</p>
        <p className="mt-1 text-xs text-gray-500">
          Glissez une pharmacie pour la déplacer dans la liste.
        </p>
      </div>
      <ol className="space-y-1">
        {entries.map((e, index) => {
          const isDragging = draggedIndex === index;
          const isOver = overIndex === index && draggedIndex !== null && !isDragging;

          return (
            <li
              key={`${e.name}-${index}`}
              draggable
              onDragStart={(event) => {
                handleDragStart(index);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", String(index));
              }}
              onDragOver={(event) => handleDragOver(event, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              className={`flex cursor-grab items-center gap-2 rounded-lg border px-2 py-1.5 text-sm text-gray-800 transition-colors active:cursor-grabbing ${
                isDragging
                  ? "border-blue-300 bg-white/80 opacity-50 shadow-sm"
                  : isOver
                    ? "border-blue-400 bg-white ring-2 ring-blue-300"
                    : "border-transparent bg-white/40 hover:bg-white/70"
              }`}
              title="Glisser pour déplacer"
            >
              <span
                className="shrink-0 select-none text-base leading-none text-gray-400"
                aria-hidden
              >
                ⠿
              </span>
              <span
                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${badgeClass}`}
              >
                {e.position}
              </span>
              <span className="min-w-0 flex-1 truncate select-none" title={e.name}>
                {shortName(e.name)}
              </span>
              {showDetail && e.detail && (
                <span className="shrink-0 select-none text-xs text-gray-500">
                  {e.detail}
                </span>
              )}
            </li>
          );
        })}
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
