import { readFileSync, existsSync } from "fs";
import { analyzeImport, parseExcelBuffer, getPharmacieParaFecha, buildRowsByDateKey } from "../src/lib/excel";
import { parseDateFR, dateKey } from "../src/lib/dates";
import type { ExcelRow } from "../src/lib/excel";

const NORMAN_DECEMBER: ExcelRow[] = [
  {
    date_debut: "24/12/2026",
    heure_debut: "19h15",
    date_fin: "25/12/2026",
    heure_fin: "19h15",
    pharmacie: "Pharmacie du Parc Olympique",
    adresse: "",
  },
  {
    date_debut: "25/12/2026",
    heure_debut: "19h15",
    date_fin: "26/12/2026",
    heure_fin: "19h15",
    pharmacie: "",
    adresse: "",
  },
  {
    date_debut: "26/12/2026",
    heure_debut: "19h15",
    date_fin: "27/12/2026",
    heure_fin: "19h15",
    pharmacie: "Pharmacie de la Pierre du Roy",
    adresse: "",
  },
  {
    date_debut: "27/12/2026",
    heure_debut: "19h15",
    date_fin: "28/12/2026",
    heure_fin: "19h15",
    pharmacie: "nan",
    adresse: "",
  },
  {
    date_debut: "28/12/2026",
    heure_debut: "19h15",
    date_fin: "29/12/2026",
    heure_fin: "19h15",
    pharmacie: "Pharmacie de la Lauzière",
    adresse: "",
  },
  {
    date_debut: "31/12/2026",
    heure_debut: "19h15",
    date_fin: "01/01/2027",
    heure_fin: "19h15",
    pharmacie: "Pharmacie République",
    adresse: "",
  },
];

function check(label: string, got: string, expected: string) {
  const ok = got.includes(expected) || expected.includes(got.replace("Pharmacie ", ""));
  console.log(`${ok ? "✅" : "❌"} ${label}: ${got || "(vide)"} (attendu: ${expected})`);
}

console.log("=== Test unitaire héritage Norman (décembre) ===\n");
const byDate = buildRowsByDateKey(NORMAN_DECEMBER);
const min = parseDateFR("24/12/2026")!;

check(
  "25/12 férié",
  getPharmacieParaFecha(parseDateFR("25/12/2026")!, byDate, min).pharmacie,
  "Parc Olympique"
);
check(
  "27/12 dimanche",
  getPharmacieParaFecha(parseDateFR("27/12/2026")!, byDate, min).pharmacie,
  "Pierre du Roy"
);
check(
  "28/12 lundi",
  getPharmacieParaFecha(parseDateFR("28/12/2026")!, byDate, min).pharmacie,
  "Lauzière"
);
check(
  "01/01/2027",
  getPharmacieParaFecha(parseDateFR("01/01/2027")!, byDate, min).pharmacie,
  "République"
);

const summary = analyzeImport(NORMAN_DECEMBER);
console.log("\n=== YearConfig inféré (échantillon décembre seul) ===");
console.log({
  last_ferie_pharma: summary.lastFeriePharma,
  last_ferie_idx: summary.lastFerieIdx,
  last_domingo_pharma: summary.lastDomingoPharma,
  last_domingo_idx: summary.lastDomingoIdx,
  last_lundi_pharma: summary.lastLundiPharma,
  last_semaine_idx: summary.lastSemaineIdx,
});

const filePath = process.argv[2];
if (filePath && existsSync(filePath)) {
  console.log(`\n=== Import fichier: ${filePath} ===`);
  const buffer = readFileSync(filePath);
  const rows = parseExcelBuffer(buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ));
  const full = analyzeImport(rows);
  console.log({
    year: full.year,
    last_ferie_pharma: full.lastFeriePharma,
    last_ferie_idx: full.lastFerieIdx,
    last_domingo_pharma: full.lastDomingoPharma,
    last_domingo_idx: full.lastDomingoIdx,
    last_lundi_pharma: full.lastLundiPharma,
    last_semaine_idx: full.lastSemaineIdx,
    totalRows: full.totalRows,
  });

  const byDateFull = buildRowsByDateKey(rows);
  const minFull = parseDateFR(rows.find((r) => r.date_debut)?.date_debut ?? "")!;
  if (minFull) {
    console.log("\n--- Vérifications décembre (fichier complet) ---");
    for (const [d, label] of [
      ["25/12/2026", "Noël"],
      ["27/12/2026", "Dimanche"],
      ["28/12/2026", "Lundi"],
      ["01/01/2027", "Jour de l'An"],
    ] as const) {
      const dt = parseDateFR(d)!;
      console.log(
        `${label} (${d}):`,
        getPharmacieParaFecha(dt, byDateFull, minFull).pharmacie
      );
    }
  }
} else if (filePath) {
  console.log(`\nFichier introuvable: ${filePath}`);
}
