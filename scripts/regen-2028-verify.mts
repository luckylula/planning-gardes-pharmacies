import { prisma } from "../src/lib/db";
import {
  generatePlanning,
  getFeriesDates,
  collectRelevantFerieDates,
} from "../src/lib/generatePlanning";
import {
  buildRotationsFromConfig,
  resolveRotationConfigForYear,
} from "../src/lib/rotations";
import { getFirstMondayOfJanuary, addDays, dateKey } from "../src/lib/dates";

async function saveYear(year: number, days: ReturnType<typeof generatePlanning>["days"], finalState: ReturnType<typeof generatePlanning>["finalState"]) {
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

async function regenerateYear(year: number) {
  const config = await resolveRotationConfigForYear(year);
  const { days, finalState } = generatePlanning(year, config);
  await saveYear(year, days, finalState);
  console.log(`Regenerated ${year}: ${days.length} days, last_ferie_idx=${finalState.last_ferie_idx} (${finalState.last_ferie_pharma})`);
  return { days, finalState, config };
}

async function checkYearEndBridge(year: number) {
  const start = getFirstMondayOfJanuary(year);
  const end = addDays(start, 363);
  const ny = getFeriesDates(year + 1)[0];
  const relevant = collectRelevantFerieDates(start, end);
  const nyIncluded = relevant.some((d) => dateKey(d) === dateKey(ny));
  const nyInOldRange = ny >= start && ny <= end;

  const row = await prisma.planningDay.findFirst({
    where: { year, date: new Date(`${year}-12-31T12:00:00`) },
  });

  return {
    year,
    windowEnd: dateKey(end),
    nyNext: dateKey(ny),
    nyInOldRange,
    nyIncludedInNewLogic: nyIncluded,
    dec31: row
      ? { type: row.type, pharmacie: row.pharmacie, heure: row.heure_debut }
      : null,
    needsRegen: nyIncluded && !nyInOldRange && row?.type !== "ferie",
  };
}

async function main() {
  console.log("=== Regenerating 2028 ===");
  await regenerateYear(2028);

  const yc2028 = await prisma.yearConfig.findUnique({ where: { year: 2028 } });
  const dec31 = await prisma.planningDay.findFirst({
    where: { year: 2028, date: new Date("2028-12-31T12:00:00") },
  });

  console.log("\n=== Verification 1-3 ===");
  console.log("31/12/2028:", dec31
    ? { type: dec31.type, pharmacie: dec31.pharmacie }
    : "(absent)");
  console.log("YearConfig 2028:", {
    last_ferie_idx: yc2028?.last_ferie_idx,
    last_ferie_pharma: yc2028?.last_ferie_pharma,
  });

  const rot2029 = buildRotationsFromConfig(
    2029,
    await resolveRotationConfigForYear(2029)
  );
  console.log("Rotation Fériés 2029 starts:", rot2029.ferie[0]?.name);

  const yc2029 = await prisma.yearConfig.findUnique({ where: { year: 2029 } });
  if (yc2029?.generated) {
    console.log("\n=== Regenerating 2029 (was generated) ===");
    await regenerateYear(2029);
    const rot2029b = buildRotationsFromConfig(
      2029,
      await resolveRotationConfigForYear(2029)
    );
    console.log("Rotation Fériés 2029 after regen:", rot2029b.ferie[0]?.name);
  } else {
    console.log("\n2029 not generated — skip regen");
  }

  console.log("\n=== Check all years for bridge issue ===");
  const years = await prisma.yearConfig.findMany({
    where: { generated: true },
    orderBy: { year: "asc" },
  });
  for (const y of years) {
    const check = await checkYearEndBridge(y.year);
    const status = check.needsRegen
      ? "⚠️  had bridge gap (old logic)"
      : check.nyIncludedInNewLogic && check.dec31?.type === "ferie"
        ? "✅ bridge ferie present"
        : check.nyInOldRange
          ? "✅ NY in old date range"
          : check.nyIncludedInNewLogic
            ? "⚠️  NY bridge needed but dec31 not ferie"
            : "— no bridge needed";
    console.log(
      `${y.year}: end=${check.windowEnd} NY+1=${check.nyNext} oldRange=${check.nyInOldRange} dec31=${check.dec31?.type ?? "n/a"} → ${status}`
    );
  }

  // Simulate 2029 end state for 2030 continuity
  const cfg2029 = await resolveRotationConfigForYear(2029);
  const sim2029 = generatePlanning(2029, cfg2029);
  const simDec31 = sim2029.days.find((d) => dateKey(d.date) === "2029-12-31");
  console.log("\n2029 simulated 31/12:", simDec31
    ? { type: simDec31.type, pharmacie: simDec31.pharmacie }
    : "(no row — last day: " + dateKey(sim2029.days[sim2029.days.length - 1].date) + ")");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
