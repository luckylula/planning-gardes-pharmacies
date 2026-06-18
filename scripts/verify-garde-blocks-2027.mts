import { generatePlanning } from "../src/lib/generatePlanning";
import {
  calcularGardesJourNuit,
  computeStats,
  isWeekendRotationRow,
} from "../src/lib/excel";
import { formatDateFR } from "../src/lib/dates";

const cfg = {
  centreStartIdx: 0,
  ferieStartIdx: 3,
  domingoStartIdx: 3,
  lundiNext: "grand_arc" as const,
  semaineStartIdx: 0,
};

const year = 2027;
const r = generatePlanning(year, cfg);
const stats = computeStats(r.days);

function showPharma(namePart: string) {
  const s = stats.find((x) => x.name.includes(namePart));
  if (!s) {
    console.log(`❌ ${namePart} introuvable`);
    return;
  }
  console.log(`\n=== ${s.name} ===`);
  for (const cat of ["ferie", "weekend", "lundi", "semaine"] as const) {
    const c = s[cat];
    if (c.turnos === 0) continue;
    console.log(
      `  ${cat}: ${c.turnos} tours · ${c.gardesJour}j · ${c.gardesNuit}n`
    );
  }
  console.log(
    `  TOTAL: ${s.totalTurnos} tours · ${s.totalGardesJour}j · ${s.totalGardesNuit}n`
  );
  console.log(
    `  Centre (fériés+week-ends): ${s.ferie.gardesJour + s.weekend.gardesJour}j · ${s.ferie.gardesNuit + s.weekend.gardesNuit}n`
  );
}

console.log("=== Tests unitaires blocs ===");
const tests = [
  {
    label: "Garde partielle 1er mai (République)",
    d: "2027-05-02",
    hd: "09h00",
    f: "2027-05-03",
    hf: "19h15",
    expect: { jour: 2, nuit: 1 },
  },
  {
    label: "Lundi 19h15 → mardi 19h15",
    d: "2027-01-04",
    hd: "19h15",
    f: "2027-01-05",
    hf: "19h15",
    expect: { jour: 1, nuit: 1 },
  },
  {
    label: "Festivo 48h mar→jeu",
    d: "2027-05-04",
    hd: "19h15",
    f: "2027-05-06",
    hf: "19h15",
    expect: { jour: 2, nuit: 2 },
  },
  {
    label: "Cas 2 ven→dim 09h00 (festivo sábado)",
    d: "2027-04-30",
    hd: "19h15",
    f: "2027-05-02",
    hf: "09h00",
    expect: { jour: 1, nuit: 2 },
  },
];

for (const t of tests) {
  const blocks = calcularGardesJourNuit(
    new Date(t.d + "T12:00:00"),
    t.hd,
    new Date(t.f + "T12:00:00"),
    t.hf
  );
  const ok =
    blocks.jour === t.expect.jour && blocks.nuit === t.expect.nuit
      ? "✅"
      : "❌";
  console.log(
    `${ok} ${t.label}: ${blocks.jour}j ${blocks.nuit}n (attendu ${t.expect.jour}j ${t.expect.nuit}n)`
  );
}

console.log(`\n=== Stats ${year} (ferieStartIdx=${cfg.ferieStartIdx}) ===`);
showPharma("République");
showPharma("du Centre");

// Détail garde partielle République
const mai = r.days.find(
  (d) =>
    d.pharmacie.includes("République") &&
    formatDateFR(d.date) === "02/05/2027" &&
    isWeekendRotationRow(d)
);
if (mai) {
  const b = calcularGardesJourNuit(
    mai.date,
    mai.heure_debut,
    mai.date_fin,
    mai.heure_fin
  );
  console.log(
    `\n--- Détail garde 02/05 République: ${b.jour}j + ${b.nuit}n ---`
  );
}
