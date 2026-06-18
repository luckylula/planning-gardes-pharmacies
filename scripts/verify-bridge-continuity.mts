import {
  generatePlanning,
  collectRelevantFerieDates,
  getFeriesDates,
} from "../src/lib/generatePlanning";
import { resolveRotationConfigForYear } from "../src/lib/rotations";
import { getFirstMondayOfJanuary, addDays, dateKey } from "../src/lib/dates";
import { prisma } from "../src/lib/db";

const PLANNING_DAYS = 364;

async function analyze(year: number) {
  const start = getFirstMondayOfJanuary(year);
  const end = addDays(start, PLANNING_DAYS - 1);
  const ny = getFeriesDates(year + 1)[0];

  const config = await resolveRotationConfigForYear(year);
  const { days, finalState } = generatePlanning(year, config);

  const ferieRows = days.filter(
    (d) => d.type === "ferie" && d.heure_debut !== "09h00"
  );
  const lastFerie = ferieRows[ferieRows.length - 1];

  // Expected bridge: first ferie guard for NY from buildFerieSchedule
  const relevant = collectRelevantFerieDates(start, end);
  const nyIncluded = relevant.some((d) => dateKey(d) === dateKey(ny));

  const dec31 = days.find((d) => dateKey(d.date) === `${year}-12-31`);
  const jan1Next = days.find(
    (d) => dateKey(d.date) === `${year + 1}-01-01`
  );

  return {
    year,
    window: `${dateKey(start)}→${dateKey(end)}`,
    ny: dateKey(ny),
    nyDow: ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"][ny.getDay()],
    nyInRelevant: nyIncluded,
    dec31: dec31 ? `${dec31.type}/${dec31.pharmacie?.replace("Pharmacie ", "")}` : "—",
    jan1Next: jan1Next
      ? `${jan1Next.type}/${jan1Next.pharmacie?.replace("Pharmacie ", "")}`
      : "—",
    lastFerieRow: lastFerie
      ? `${dateKey(lastFerie.date)} ${lastFerie.pharmacie?.replace("Pharmacie ", "")}`
      : "—",
    lastFerieIdx: finalState.last_ferie_idx,
    nextYearStart: (finalState.last_ferie_idx + 1) % 8,
  };
}

async function main() {
  console.log("=== Continuité pont Jour de l'An (2028-2035) ===\n");
  for (const y of [2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035]) {
    const a = await analyze(y);
    const windowCoversDec31 = a.window.split("→")[1] >= `${y}-12-31`;
    const hasBridgeFerie =
      a.dec31.includes("ferie") ||
      (a.jan1Next.includes("ferie") && a.nyDow === "dim");
    const ok = a.nyInRelevant && hasBridgeFerie;
    console.log(
      `${ok ? "✅" : "❌"} ${y}: fenêtre ${a.window} | NY ${a.ny} (${a.nyDow}) | ` +
        `relevant=${a.nyInRelevant} | 31/12=${a.dec31} | 01/01+1=${a.jan1Next} | ` +
        `dernier férié ${a.lastFerieRow} → idx+1=${a.nextYearStart}`
    );
  }

  console.log("\n=== 2030 depuis YearConfig 2029 (DB) ===");
  const yc2029 = await prisma.yearConfig.findUnique({ where: { year: 2029 } });
  const cfg2030 = await resolveRotationConfigForYear(2030);
  const r2030 = generatePlanning(2030, cfg2030);
  const bridge = r2030.days.find(
    (d) =>
      d.type === "ferie" &&
      d.heure_debut !== "09h00" &&
      dateKey(d.date) === "2030-12-31"
  );
  console.log("YearConfig 2029 last_ferie:", yc2029?.last_ferie_idx, yc2029?.last_ferie_pharma);
  console.log("Config 2030 ferieStartIdx:", cfg2030.ferieStartIdx);
  console.log("2030 bridge 31/12:", bridge?.pharmacie ?? "ABSENT");
  console.log("2030 final last_ferie:", r2030.finalState.last_ferie_pharma);

  console.log("\n=== 2031 depuis YearConfig 2030 simulé ===");
  const cfg2031 = {
    ...cfg2030,
    ferieStartIdx: (r2030.finalState.last_ferie_idx + 1) % 8,
    centreStartIdx: (r2030.finalState.last_domingo_idx + 1) % 8,
    domingoStartIdx: (r2030.finalState.last_domingo_idx + 1) % 8,
    lundiNext: "lauziere" as const,
    semaineStartIdx: 0,
  };
  const r2031 = generatePlanning(2031, cfg2031);
  const bridge31 = r2031.days.find(
    (d) =>
      d.type === "ferie" &&
      d.heure_debut !== "09h00" &&
      dateKey(d.date) === "2031-12-31"
  );
  console.log("2031 ferieStartIdx:", cfg2031.ferieStartIdx);
  console.log("2031 bridge 31/12:", bridge31?.pharmacie ?? "ABSENT");
  console.log("2031 final last_ferie:", r2031.finalState.last_ferie_pharma);

  await prisma.$disconnect();
}

main();
