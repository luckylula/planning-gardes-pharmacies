import { generatePlanning, getEaster } from "../src/lib/generatePlanning";
import { dateKey, formatDateFR } from "../src/lib/dates";

function findAround(days: ReturnType<typeof generatePlanning>["days"], center: string) {
  const idx = days.findIndex((d) => dateKey(d.date) === center);
  return days.slice(Math.max(0, idx - 2), idx + 4).map((d) => ({
    debut: formatDateFR(d.date),
    fin: formatDateFR(d.date_fin),
    type: d.type,
    p: d.pharmacie.replace("Pharmacie ", "").slice(0, 20),
  }));
}

const r = generatePlanning(2027, {
  centreStartIdx: 0,
  ferieStartIdx: 0,
  domingoStartIdx: 0,
  lundiNext: "grand_arc",
  semaineStartIdx: 0,
});

console.log("Easter 2027:", formatDateFR(getEaster(2027)));
console.log("Total rows:", r.days.length);

// Lundi de Pâques 2027 = 29/03
const paques = r.days.filter(
  (d) =>
    dateKey(d.date) >= "2027-03-26" && dateKey(d.date) <= "2027-03-31"
);
console.log("\n=== Semaine Pâques 2027 ===");
paques.forEach((d) =>
  console.log(
    `${formatDateFR(d.date)} → ${formatDateFR(d.date_fin)} | ${d.type} | ${d.pharmacie}`
  )
);

const feriePaques = r.days.find(
  (d) => d.type === "ferie" && dateKey(d.date) === "2027-03-28"
);
console.log(
  feriePaques
    ? "✅ Garde Pâques: " +
        formatDateFR(feriePaques.date) +
        " → " +
        formatDateFR(feriePaques.date_fin)
    : "❌ Pas de garde Pâques"
);

// Ascension 2027 = 06/05 (jeudi)
const asc = r.days.filter(
  (d) =>
    dateKey(d.date) >= "2027-05-04" && dateKey(d.date) <= "2027-05-08"
);
console.log("\n=== Semaine Ascension 2027 ===");
asc.forEach((d) =>
  console.log(
    `${formatDateFR(d.date)} → ${formatDateFR(d.date_fin)} | ${d.type} | ${d.pharmacie}`
  )
);

const ferieAsc = r.days.find(
  (d) => d.type === "ferie" && dateKey(d.date) === "2027-05-05"
);
console.log(
  ferieAsc
    ? "✅ Garde Ascension: " +
        formatDateFR(ferieAsc.date) +
        " → " +
        formatDateFR(ferieAsc.date_fin)
    : "❌ Pas de garde Ascension"
);

// 1er mai 2027 = samedi
const mai = r.days.filter(
  (d) =>
    dateKey(d.date) >= "2027-04-29" && dateKey(d.date) <= "2027-05-03"
);
console.log("\n=== 1er mai 2027 (samedi) ===");
mai.forEach((d) =>
  console.log(
    `${formatDateFR(d.date)} → ${formatDateFR(d.date_fin)} | ${d.type} | ${d.pharmacie}`
  )
);
