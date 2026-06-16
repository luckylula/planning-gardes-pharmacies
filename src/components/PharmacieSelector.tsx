"use client";

import {
  PHARMACIES_CENTRE,
  PHARMACIES_EXTERIEURES,
  PHARMACIES_MAURIENNE,
} from "@/lib/pharmacies";

interface PharmacieSelectorProps {
  value: string;
  onChange: (name: string, adresse: string) => void;
  allowEmpty?: boolean;
}

export default function PharmacieSelector({
  value,
  onChange,
  allowEmpty = false,
}: PharmacieSelectorProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value;
    if (!name) {
      onChange("", "");
      return;
    }
    const all = [
      ...PHARMACIES_CENTRE,
      ...PHARMACIES_MAURIENNE,
      ...PHARMACIES_EXTERIEURES,
    ];
    const pharma = all.find((p) => p.name === name);
    onChange(name, pharma?.adresse ?? "");
  };

  return (
    <select
      value={value}
      onChange={handleChange}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
    >
      {allowEmpty && <option value="">— Vide —</option>}
      <optgroup label="Centre Albertville">
        {PHARMACIES_CENTRE.map((p) => (
          <option key={p.id} value={p.name}>
            {p.name}
          </option>
        ))}
      </optgroup>
      <optgroup label="Maurienne (lundis)">
        {PHARMACIES_MAURIENNE.map((p) => (
          <option key={p.id} value={p.name}>
            {p.name}
          </option>
        ))}
      </optgroup>
      <optgroup label="Extérieures (mar-ven)">
        {PHARMACIES_EXTERIEURES.map((p) => (
          <option key={p.id} value={p.name}>
            {p.name}
          </option>
        ))}
      </optgroup>
    </select>
  );
}
