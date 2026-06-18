import { prisma } from "../src/lib/db";
import {
  generatePlanning,
  planningBoundsForYear,
  configFromYearConfig,
  getFeriesDates,
} from "../src/lib/generatePlanning";
import {
  buildRotationsFromConfig,
  resolveRotationConfigForYear,
} from "../src/lib/rotations";
import { getFirstMondayOfJanuary, dateKey } from "../src/lib/dates";
import { PHARMACIES_CENTRE } from "../src/lib/pharmacies";

const PROBLEM_YEARS = [2029, 2035, 2040, 2046];

async function saveYear(
  year: number,
  days: ReturnType<typeof generatePlanning>["days"],
  finalState: ReturnType<typeof generatePlanning>["finalState"]
) {
  await prisma.$transaction([
    prisma.planningDay.deleteMany({ where: { year } }),
    prisma.planningDay.createMany({
      data: days.map((d) => ({
        year: d.year,
        date: d.date,
        heure_debut: d.heure_debut,
        date_fin: d.date_fin,
        heure_fin: d.heure_fin,
        pharmacie: d.pharmacie,
        adresse: d.adresse,
        type: d.type,
      })),
    }),
    prisma.yearConfig.upsert({
      where: { year },
      create: { year, ...finalState, generated: true },
      update: { ...finalState, generated: true },
    }),
  ]);
}

async function simulateYear(year: number) {
  const bounds = planningBoundsForYear(year);
  const config = await resolveRotationConfigForYear(year);
  const { days, finalState } = generatePlanning(year, config);
  const bridge = days.find(
    (d) =>
      d.type === "ferie" &&
      d.heure_debut !== "09h00" &&
      dateKey(d.date) === `${year}-12-31`
  );
  const nextConfig = configFromYearConfig(finalState);
  const nextStart = PHARMACIES_CENTRE[nextConfig.ferieStartIdx].name;
  const ny = getFeriesDates(year + 1)[0];
  const y1Start = getFirstMondayOfJanuary(year + 1);

  return {
    year,
    baseDays: bounds.dayCount,
    extended: bounds.dayCount > 364,
    windowEnd: dateKey(bounds.end),
    bridge: bridge
      ? { date: dateKey(bridge.date), pharmacie: bridge.pharmacie }
      : null,
    lastFerieIdx: finalState.last_ferie_idx,
    lastFeriePharma: finalState.last_ferie_pharma,
    nextFerieStart: nextStart,
    ny: dateKey(ny),
    y1PlanningStart: dateKey(y1Start),
    overlap: bounds.end >= y1Start,
  };
}

async function main() {
  console.log("=== AVANT regen — Rotation Fériés 2030 ===");
  const rot2030Before = buildRotationsFromConfig(
    2030,
    await resolveRotationConfigForYear(2030)
  );
  const yc2029Before = await prisma.yearConfig.findUnique({ where: { year: 2029 } });
  console.log("YearConfig 2029:", {
    last_ferie_idx: yc2029Before?.last_ferie_idx,
    last_ferie_pharma: yc2029Before?.last_ferie_pharma,
  });
  console.log(
    "Rotation Fériés 2030:",
    rot2030Before.ferie.map((r) => r.name.replace("Pharmacie ", "")).join(" → ")
  );
  console.log("Premier férié 2030:", rot2030Before.ferie[0]?.name);

  console.log("\n=== Simulation 4 années problématiques ===\n");
  for (const y of PROBLEM_YEARS) {
    const s = await simulateYear(y);
    const ok = s.bridge && !s.overlap;
    console.log(`${ok ? "✅" : "❌"} ${y}:`);
    console.log(`   Jours planning: ${s.baseDays}${s.extended ? " (étendu +1)" : ""}`);
    console.log(`   Fin fenêtre: ${s.windowEnd}`);
    console.log(`   Pont 31/12: ${s.bridge ? s.bridge.pharmacie : "ABSENT"}`);
    console.log(`   last_ferie_idx: ${s.lastFerieIdx} (${s.lastFeriePharma})`);
    console.log(`   → ferieStart ${y + 1}: ${s.nextFerieStart}`);
    console.log(`   Planning ${y + 1} démarre: ${s.y1PlanningStart} (pas de chevauchement: ${!s.overlap})`);
    console.log();
  }

  console.log("=== Scan 2026-2050 après fix ===");
  let fails = 0;
  for (let y = 2026; y <= 2050; y++) {
    const bounds = planningBoundsForYear(y);
    const config = await resolveRotationConfigForYear(y);
    const { days } = generatePlanning(y, config);
    const bridge = days.find(
      (d) =>
        d.type === "ferie" &&
        d.heure_debut !== "09h00" &&
        dateKey(d.date) === `${y}-12-31`
    );
    const ny = getFeriesDates(y + 1)[0];
    const needsBridge =
      bounds.dayCount > 364 ||
      (bridge === undefined &&
        planningBoundsForYear(y).end < `${y}-12-31`);
    // simpler: if extended, must have bridge
    if (bounds.dayCount > 364 && !bridge) {
      fails++;
      console.log(`❌ ${y} extended but no bridge`);
    }
  }
  console.log(fails === 0 ? "✅ Aucun échec 2026-2050" : `❌ ${fails} échecs`);

  console.log("\n=== Regénération 2029 puis 2030 ===");
  const cfg2029 = await resolveRotationConfigForYear(2029);
  const r2029 = generatePlanning(2029, cfg2029);
  await saveYear(2029, r2029.days, r2029.finalState);
  console.log("2029 regen OK — last_ferie:", r2029.finalState.last_ferie_pharma);

  const cfg2030 = await resolveRotationConfigForYear(2030);
  const r2030 = generatePlanning(2030, cfg2030);
  await saveYear(2030, r2030.days, r2030.finalState);
  console.log("2030 regen OK — last_ferie:", r2030.finalState.last_ferie_pharma);

  console.log("\n=== APRÈS regen — Rotation Fériés 2030 ===");
  const rot2030After = buildRotationsFromConfig(
    2030,
    await resolveRotationConfigForYear(2030)
  );
  const yc2029After = await prisma.yearConfig.findUnique({ where: { year: 2029 } });
  console.log("YearConfig 2029:", {
    last_ferie_idx: yc2029After?.last_ferie_idx,
    last_ferie_pharma: yc2029After?.last_ferie_pharma,
  });
  console.log(
    "Rotation Fériés 2030:",
    rot2030After.ferie.map((r) => r.name.replace("Pharmacie ", "")).join(" → ")
  );
  console.log("Premier férié 2030:", rot2030After.ferie[0]?.name);

  const dec312029 = await prisma.planningDay.findFirst({
    where: { year: 2029, date: new Date("2029-12-31T12:00:00") },
  });
  console.log("\n31/12/2029 en DB:", dec312029
    ? { type: dec312029.type, pharmacie: dec312029.pharmacie }
    : "(absent)");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
