import {
  configFromYearConfig,
  generatePlanning,
  getEaster,
  getFeriesDates,
} from "../src/lib/generatePlanning";
import { dateKey, formatDateFR } from "../src/lib/dates";
import { PHARMACIES_CENTRE, PHARMACIES_MAURIENNE } from "../src/lib/pharmacies";
import { computeStats } from "../src/lib/excel";

const easter = getEaster(2026);
console.log("Easter 2026:", formatDateFR(easter), "(attendu 05/04/2026)");

const feries = getFeriesDates(2026).map((d) => formatDateFR(d));
console.log("Fériés 2026:", feries.join(", "));

const r2026 = generatePlanning(2026, {
  centreStartIdx: 0,
  ferieStartIdx: 0,
  domingoStartIdx: 0,
  lundiNext: "grand_arc",
  semaineStartIdx: 0,
});

const jan9 = r2026.days.find((d) => dateKey(d.date) === "2026-01-09");
console.log("\n09/01/2026:", jan9?.type, jan9?.pharmacie ?? "(vide)");

const badMondays = r2026.days.filter(
  (d) =>
    d.date.getDay() === 1 &&
    d.pharmacie &&
    !d.pharmacie.includes("Lauzière") &&
    !d.pharmacie.includes("Grand Arc") &&
    d.type !== "ferie"
);
console.log("Lundis incorrects:", badMondays.length);

const saturdays = r2026.days.filter((d) => d.date.getDay() === 6);
const badSaturdays = saturdays.filter(
  (d) => !PHARMACIES_CENTRE.some((p) => p.name === d.pharmacie)
);
console.log("Samedis incorrects:", badSaturdays.length);

const stats = computeStats(r2026.days);
const withZero = stats.filter((s) => s.count === 0);
console.log("\nPharmacies sans garde:", withZero.length);
withZero.forEach((s) => console.log(" -", s.name));

console.log("\nFin 2026 centre idx:", r2026.finalState.last_domingo_idx, PHARMACIES_CENTRE[r2026.finalState.last_domingo_idx]?.name);

const cfg2027 = configFromYearConfig(r2026.finalState);
console.log("\nDépart 2027:");
console.log("  centre idx:", cfg2027.centreStartIdx, PHARMACIES_CENTRE[cfg2027.centreStartIdx]?.name);
console.log("  lundi:", cfg2027.lundiNext, cfg2027.lundiNext === "grand_arc" ? PHARMACIES_MAURIENNE[1].name : PHARMACIES_MAURIENNE[0].name);
console.log("  extérieures idx:", cfg2027.semaineStartIdx);

const r2027 = generatePlanning(2027, cfg2027);
const stats2027 = computeStats(r2027.days);
console.log("\n2027 pharmacies actives:", stats2027.filter((s) => s.count > 0).length, "/ 20");
