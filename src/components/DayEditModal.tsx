"use client";

import { useState } from "react";
import PharmacieSelector from "./PharmacieSelector";

export interface PlanningDayRow {
  id: number;
  date: string;
  date_fin: string;
  pharmacie: string;
  adresse: string;
  type: string;
  note?: string | null;
  modified: boolean;
}

interface DayEditModalProps {
  day: PlanningDayRow | null;
  onClose: () => void;
  onSave: (id: number, pharmacie: string, adresse: string, note: string) => void;
}

export default function DayEditModal({
  day,
  onClose,
  onSave,
}: DayEditModalProps) {
  const [pharmacie, setPharmacie] = useState(day?.pharmacie ?? "");
  const [adresse, setAdresse] = useState(day?.adresse ?? "");
  const [note, setNote] = useState(day?.note ?? "");

  if (!day) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-1 text-lg font-semibold">Modifier la garde</h2>
        <p className="mb-4 text-sm text-gray-500">
          {new Date(day.date).toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>

        <label className="mb-1 block text-sm font-medium text-gray-700">
          Pharmacie
        </label>
        <PharmacieSelector
          value={pharmacie}
          onChange={(n, a) => {
            setPharmacie(n);
            setAdresse(a);
          }}
          allowEmpty={day.type === "vide" || day.type === "weekend"}
        />

        <label className="mb-1 mt-4 block text-sm font-medium text-gray-700">
          Note (optionnel)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="Ex: échange avec une autre pharmacie..."
        />

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onSave(day.id, pharmacie, adresse, note)}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
}
