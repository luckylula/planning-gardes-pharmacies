"use client";

interface YearSelectorProps {
  value: number;
  onChange: (year: number) => void;
  minYear?: number;
  maxYear?: number;
}

export default function YearSelector({
  value,
  onChange,
  minYear = 2024,
  maxYear = 2035,
}: YearSelectorProps) {
  const years = [];
  for (let y = minYear; y <= maxYear; y++) years.push(y);

  return (
    <select
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value, 10))}
      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
    >
      {years.map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  );
}
