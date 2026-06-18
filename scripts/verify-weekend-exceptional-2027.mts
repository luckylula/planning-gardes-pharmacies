import { generatePlanning } from "../src/lib/generatePlanning";
import {
  computeStats,
  guardDurationDays,
  isFerieRotationRow,
  isWeekendRotationRow,
} from "../src/lib/excel";
import { dateKey, formatDateFR, getDayNameFR, addDays } from "../src/lib/dates";
import { getFeriesDates } from "../src/lib/generatePlanning";

const cfg = {
  centreStartIdx: 0,
  ferieStartIdx: 3,
  domingoStartIdx: 3,
  lundiNext: "grand_arc" as const,
  semaineStartIdx: 0,
};

const year = 2027;
const r = generatePlanning(year, cfg);

const FERIE_NAMES: Record<string, string> = {
  "2027-01-01": "Jour de l'An",
  "2027-03-29": "Lundi de Pâques",
  "2027-05-01": "1er mai",
  "2027-05-08": "8 mai",
  "2027-05-06": "Ascension",
  "2027-05-17": "Lundi de Pentecôte",
  "2027-07-14": "Fête nationale",
  "2027-08-15": "Assomption",
  "2027-11-01": "Toussaint",
  "2027-11-11": "Armistice",
  "2027-12-25": "Noël",
};

function tabFor(day: (typeof r.days)[0]): string {
  if (isWeekendRotationRow(day)) return "Week-ends";
  if (isFerieRotationRow(day)) return "Fériés";
  return day.type;
}

function guardLabel(day: (typeof r.days)[0]): string {
  const rot =
    day.centreRotation ??
    (day.type === "ferie" && day.heure_debut === "09h00" ? "domingo" : "ferie");
  const dur = guardDurationDays(
    day.date,
    day.date_fin,
    day.heure_debut,
    day.heure_fin
  ).toFixed(2);
  return `${formatDateFR(day.date)} ${day.heure_debut} → ${formatDateFR(day.date_fin)} ${day.heure_fin} | ${day.pharmacie.replace(/^Pharmacie /, "")} | rot=${rot} | ${dur}j | → ${tabFor(day)}`;
}

const exceptionalFeries = getFeriesDates(year).filter((d) => {
  const dow = d.getDay();
  return dow === 6 || dow === 1;
});

console.log(`\n=== Week-ends exceptionnels ${year} (férié samedi ou lundi) ===\n`);
console.log(`Config: ferieStartIdx=${cfg.ferieStartIdx}, domingoStartIdx=${cfg.domingoStartIdx}\n`);

function guardCoversFerie(day: (typeof r.days)[0], ferie: Date): boolean {
  const start = day.date.getTime();
  const end = day.date_fin.getTime();
  const t = ferie.getTime();
  return t >= start && t <= end;
}

function guardsForExceptionalFerie(ferie: Date): (typeof r.days)[number][] {
  const dow = ferie.getDay();
  if (dow === 6) {
    const sunday = addDays(ferie, 1);
    return r.days.filter(
      (d) =>
        (isFerieRotationRow(d) && guardCoversFerie(d, ferie)) ||
        (isWeekendRotationRow(d) &&
          d.type === "ferie" &&
          dateKey(d.date) === dateKey(sunday) &&
          d.heure_debut === "09h00")
    );
  }
  if (dow === 1) {
    const saturday = addDays(ferie, -2);
    return r.days.filter(
      (d) =>
        (d.type === "weekend" && dateKey(d.date) === dateKey(saturday)) ||
        (isFerieRotationRow(d) && guardCoversFerie(d, ferie))
    );
  }
  return [];
}

for (const ferie of exceptionalFeries) {
  const key = dateKey(ferie);
  const cas = ferie.getDay() === 6 ? "Cas 2 (samedi)" : "Cas 3 (lundi)";
  const name = FERIE_NAMES[key] ?? key;
  console.log(`--- ${name} (${getDayNameFR(ferie)} ${formatDateFR(ferie)}) — ${cas} ---`);

  const guards = guardsForExceptionalFerie(ferie);

  guards.forEach((g, i) => console.log(`  ${i + 1}. ${guardLabel(g)}`));
  console.log();
}

// Vérification 1er mai 2027
const maiDomingo = r.days.find(
  (d) =>
    dateKey(d.date) === "2027-05-02" &&
    d.heure_debut === "09h00" &&
    isWeekendRotationRow(d)
);
console.log("--- Vérification 1er mai 2027 ---");
console.log(
  maiDomingo
    ? `✅ Garde partielle dimanche: ${guardLabel(maiDomingo)}`
    : "❌ Garde partielle dimanche manquante"
);

const stats = computeStats(r.days);
const rep = stats.find((s) => s.name.includes("République"));
if (rep && maiDomingo) {
  console.log(
    `✅ Stats République week-end: ${rep.weekend.turnos} tours, ${rep.weekend.gardesJour.toFixed(1)}j, ${rep.weekend.gardesNuit.toFixed(1)}n`
  );
}
