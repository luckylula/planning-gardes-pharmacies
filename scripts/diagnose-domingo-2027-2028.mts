import { prisma } from "../src/lib/db";
import { enrichVideDaysFromWeekend, isWeekendRotationRow } from "../src/lib/excel";
import {
  buildRotationsFromConfig,
  resolveRotationConfigForYear,
} from "../src/lib/rotations";
import { configFromYearConfig } from "../src/lib/generatePlanning";
import { inferEndStateFromPlanningDays } from "../src/lib/planningRotationState";
import { PHARMACIES_CENTRE } from "../src/lib/pharmacies";
import { formatDateFR } from "../src/lib/dates";

function idxOf(name: string) {
  return PHARMACIES_CENTRE.findIndex((p) => p.name === name);
}

async function main() {
  const raw = await prisma.planningDay.findMany({
    where: { year: 2027 },
    orderBy: { date: "asc" },
  });
  const days = enrichVideDaysFromWeekend(raw).map((d) => ({
    ...d,
    type: d.type as import("../src/lib/types").PlanningDayInput["type"],
    centreRotation: (d as { centreRotation?: string }).centreRotation,
  }));

  const yc = await prisma.yearConfig.findUnique({ where: { year: 2027 } });
  const end = inferEndStateFromPlanningDays(days, 2027);
  const cfg2028 = await resolveRotationConfigForYear(2028);
  const rot2028 = buildRotationsFromConfig(2028, cfg2028);

  console.log("=== YearConfig 2027 domingo ===");
  console.log({
    last_domingo_pharma: yc?.last_domingo_pharma,
    last_domingo_idx: yc?.last_domingo_idx,
  });

  console.log("\n=== Toutes gardes rotation dimanches 2027 (isWeekendRotationRow) ===");
  const domingoRows: { date: string; heure: string; pharma: string; idx: number; type: string }[] = [];
  for (const d of days) {
    if (d.date.getFullYear() !== 2027) continue;
    if (!d.pharmacie || idxOf(d.pharmacie) < 0) continue;
    if (
      isWeekendRotationRow({
        type: d.type,
        heure_debut: d.heure_debut,
        centreRotation: d.centreRotation as "ferie" | "domingo" | undefined,
      })
    ) {
      domingoRows.push({
        date: formatDateFR(d.date),
        heure: d.heure_debut,
        pharma: d.pharmacie,
        idx: idxOf(d.pharmacie),
        type: d.type,
      });
    }
  }
  for (const r of domingoRows) {
    console.log(
      `  ${r.date} ${r.heure} [${r.type}] → ${r.pharma.replace("Pharmacie ", "")} (idx ${r.idx})`
    );
  }
  const lastRow = domingoRows.at(-1);
  console.log(
    "\nDernière isWeekendRotationRow:",
    lastRow
      ? `${lastRow.date} ${lastRow.heure} → ${lastRow.pharma} (idx ${lastRow.idx})`
      : "(aucune)"
  );

  console.log("\n=== Samedis type=weekend uniquement (déc 2027) ===");
  for (const d of days.filter(
    (x) =>
      x.date.getFullYear() === 2027 &&
      x.date.getMonth() === 11 &&
      x.date.getDay() === 6
  )) {
    console.log(
      `  ${formatDateFR(d.date)} ${d.heure_debut} [${d.type}] → ${d.pharmacie} (idx ${idxOf(d.pharmacie)})`
    );
  }

  console.log("\n=== inferEndState domingo ===");
  console.log({
    last_domingo_pharma: end.last_domingo_pharma,
    last_domingo_idx: end.last_domingo_idx,
  });
  console.log(
    "domingoStartIdx 2028 (infer):",
    configFromYearConfig(end).domingoStartIdx,
    "=",
    PHARMACIES_CENTRE[configFromYearConfig(end).domingoStartIdx].name
  );
  if (yc) {
    console.log(
      "domingoStartIdx 2028 (YearConfig):",
      configFromYearConfig(yc).domingoStartIdx,
      "=",
      PHARMACIES_CENTRE[configFromYearConfig(yc).domingoStartIdx].name
    );
  }
  console.log("\nRotation Dimanches 2028 début:", rot2028.domingo[0]?.name);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
