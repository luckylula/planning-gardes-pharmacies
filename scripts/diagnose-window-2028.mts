import { getFirstMondayOfJanuary, addDays, dateKey } from "../src/lib/dates";
import { getFeriesDates, generatePlanning } from "../src/lib/generatePlanning";
import { configFromYearConfig } from "../src/lib/generatePlanning";
import { resolveRotationConfigForYear } from "../src/lib/rotations";
import { PHARMACIES_CENTRE } from "../src/lib/pharmacies";

async function main() {
  for (const year of [2027, 2028]) {
    const start = getFirstMondayOfJanuary(year);
    const end = addDays(start, 363);
    const ny = getFeriesDates(year + 1)[0];
    console.log(`=== Planning ${year} ===`);
    console.log(`  start: ${dateKey(start)}`);
    console.log(`  end:   ${dateKey(end)}`);
    console.log(
      `  Jour de l'An ${year + 1} (${dateKey(ny)}): in ferieDate range? ${ny >= start && ny <= end}`
    );
  }

  const config2028 = await resolveRotationConfigForYear(2028);
  const { days, finalState } = generatePlanning(2028, config2028);

  console.log("\n=== Simulated generate 2028 ferie guards ===");
  const ferieGuards = days.filter(
    (d) => d.type === "ferie" && d.heure_debut !== "09h00"
  );
  for (const d of ferieGuards) {
    const idx = PHARMACIES_CENTRE.findIndex((p) => p.name === d.pharmacie);
    console.log(`  ${dateKey(d.date)} → ${d.pharmacie.replace("Pharmacie ", "")} (idx ${idx})`);
  }
  console.log("\nfinalState last ferie:", finalState.last_ferie_idx, finalState.last_ferie_pharma);
  console.log(
    "→ 2029 start would be:",
    PHARMACIES_CENTRE[(finalState.last_ferie_idx + 1) % 8].name
  );

  const dec31 = days.find((d) => dateKey(d.date) === "2028-12-31");
  console.log("\n31/12/2028 row in generated planning:", dec31 ?? "(absent)");

  const { prisma } = await import("../src/lib/db");
  for (const y of [2027, 2028]) {
    const row = await prisma.planningDay.findFirst({
      where: { year: y, date: new Date(`${y}-12-31T12:00:00`) },
    });
    console.log(`\nDB 31/12/${y}:`, row
      ? { type: row.type, heure_debut: row.heure_debut, pharmacie: row.pharmacie }
      : "(absent)");
  }
  await prisma.$disconnect();
}

main();
