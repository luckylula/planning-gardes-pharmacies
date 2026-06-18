import { generatePlanning } from "../src/lib/generatePlanning";
import { dateKey, formatDateFR } from "../src/lib/dates";

const cfg = {
  centreStartIdx: 0,
  ferieStartIdx: 0,
  domingoStartIdx: 0,
  lundiNext: "grand_arc" as const,
  semaineStartIdx: 0,
};

const r = generatePlanning(2027, cfg);

function show(label: string, from: string, to: string) {
  console.log(`\n=== ${label} ===`);
  r.days
    .filter((d) => dateKey(d.date) >= from && dateKey(d.date) <= to)
    .forEach((d) =>
      console.log(
        `${formatDateFR(d.date)} ${d.heure_debut} → ${formatDateFR(d.date_fin)} ${d.heure_fin} | ${d.type} | ${d.pharmacie.replace("Pharmacie ", "")}`
      )
    );
}

show("Lundi de Pâques 2027 (cas 3)", "2027-03-27", "2027-03-31");
show("1er mai 2027 samedi (cas 2)", "2027-04-30", "2027-05-04");
show("Assomption 2027 dimanche (cas 4)", "2027-08-13", "2027-08-17");
show("Ascension 2027 jeudi (cas 1)", "2027-05-04", "2027-05-08");

const paques = r.days.filter(
  (d) => dateKey(d.date) >= "2027-03-27" && dateKey(d.date) <= "2027-03-30"
);
const mai = r.days.filter(
  (d) => dateKey(d.date) >= "2027-04-30" && dateKey(d.date) <= "2027-05-03"
);
const assomption = r.days.find(
  (d) => d.type === "ferie" && dateKey(d.date) === "2027-08-14"
);

console.log("\n--- Checks ---");
console.log(
  paques.length === 2 && paques[0].type === "weekend" && paques[1].type === "ferie"
    ? "✅ Pâques: 2 filas (weekend + ferie)"
    : `❌ Pâques: ${paques.length} filas`
);
console.log(
  paques[0]?.pharmacie !== paques[1]?.pharmacie
    ? "✅ Pâques: pharmacies différentes"
    : "❌ Pâques: même pharmacie"
);
console.log(
  mai.length === 2 &&
    mai[0].heure_fin === "09h00" &&
    mai[1].heure_debut === "09h00"
    ? "✅ 1er mai: 2 filas avec coupure 09h00"
    : `❌ 1er mai: ${mai.length} filas`
);
console.log(
  mai[0]?.pharmacie !== mai[1]?.pharmacie
    ? "✅ 1er mai: pharmacies différentes"
    : "❌ 1er mai: même pharmacie"
);
console.log(
  assomption && dateKey(assomption.date_fin) === "2027-08-16"
    ? `✅ Assomption: ${formatDateFR(assomption.date)} → ${formatDateFR(assomption.date_fin)} (48h fériés)`
    : "❌ Assomption incorrecte"
);
