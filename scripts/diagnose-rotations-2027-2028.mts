import { prisma } from "../src/lib/db";
import { enrichVideDaysFromWeekend } from "../src/lib/excel";
import {
  buildRotationsFromConfig,
  resolveRotationConfigForYear,
} from "../src/lib/rotations";
import {
  configFromYearConfig,
  getFeriesDates,
} from "../src/lib/generatePlanning";
import {
  inferEndStateFromPlanningDays,
  findFerieRotationForDate,
} from "../src/lib/planningRotationState";
import { PHARMACIES_CENTRE } from "../src/lib/pharmacies";
import { dateKey, formatDateFR } from "../src/lib/dates";

async function loadDays(year: number) {
  const raw = await prisma.planningDay.findMany({
    where: { year },
    orderBy: { date: "asc" },
  });
  return enrichVideDaysFromWeekend(raw).map((d) => ({
    year: d.year,
    date: d.date,
    heure_debut: d.heure_debut,
    date_fin: d.date_fin,
    heure_fin: d.heure_fin,
    pharmacie: d.pharmacie,
    adresse: d.adresse,
    type: d.type as import("../src/lib/types").PlanningDayInput["type"],
    centreRotation: (d as { centreRotation?: string }).centreRotation,
  }));
}

function idxOf(name: string): number {
  return PHARMACIES_CENTRE.findIndex((p) => p.name === name);
}

async function main() {
  const yc2027 = await prisma.yearConfig.findUnique({ where: { year: 2027 } });
  const days2027 = await loadDays(2027);
  const end2027 = inferEndStateFromPlanningDays(days2027, 2027);
  const cfg2028 = await resolveRotationConfigForYear(2028);
  const rot2027 = buildRotationsFromConfig(
    2027,
    await resolveRotationConfigForYear(2027)
  );
  const rot2028 = buildRotationsFromConfig(2028, cfg2028);

  console.log("=== 1. YearConfig 2027 en base ===");
  console.log(
    yc2027
      ? {
          last_ferie_pharma: yc2027.last_ferie_pharma,
          last_ferie_idx: yc2027.last_ferie_idx,
          last_domingo_pharma: yc2027.last_domingo_pharma,
          last_domingo_idx: yc2027.last_domingo_idx,
          last_lundi_pharma: yc2027.last_lundi_pharma,
          last_semaine_idx: yc2027.last_semaine_idx,
        }
      : "(absent)"
  );

  console.log("\n=== 2. Tous les fériés 2027 (planning DB) ===");
  const feries2027 = getFeriesDates(2027);
  console.log(`Fériés calendrier: ${feries2027.length}`);
  const ferieUsage: { date: string; pharmacie: string; idx: number; row: string }[] = [];
  for (const f of feries2027) {
    const guard = findFerieRotationForDate(days2027, f);
    if (guard?.pharmacie) {
      ferieUsage.push({
        date: formatDateFR(f),
        pharmacie: guard.pharmacie,
        idx: idxOf(guard.pharmacie),
        row: formatDateFR(guard.date),
      });
    } else {
      console.log(`  MANQUANT: ${formatDateFR(f)}`);
    }
  }
  for (const u of ferieUsage) {
    console.log(
      `  ${u.date} → ${u.pharmacie.replace("Pharmacie ", "")} (idx ${u.idx}, ligne ${u.row})`
    );
  }
  console.log(`Fériés couverts: ${ferieUsage.length}`);
  const last = ferieUsage.at(-1);
  console.log(
    "\nDernier férié (calendrier):",
    last ? `${last.date} → ${last.pharmacie} (idx ${last.idx})` : "(non trouvé)"
  );

  let lastFerieRow: { date: string; pharmacie: string; idx: number } | null = null;
  for (const d of days2027) {
    if (
      d.type === "ferie" &&
      d.heure_debut !== "09h00" &&
      d.pharmacie &&
      idxOf(d.pharmacie) >= 0
    ) {
      lastFerieRow = {
        date: formatDateFR(d.date),
        pharmacie: d.pharmacie,
        idx: idxOf(d.pharmacie),
      };
    }
  }
  console.log(
    "Dernier type=ferie 19h15:",
    lastFerieRow
      ? `${lastFerieRow.date} → ${lastFerieRow.pharmacie} (idx ${lastFerieRow.idx})`
      : "(non trouvé)"
  );

  for (const d of days2027.filter((d) => d.type === "ferie")) {
    console.log(
      `  ${formatDateFR(d.date)} ${d.heure_debut} → ${d.pharmacie.replace("Pharmacie ", "")} (idx ${idxOf(d.pharmacie)})`
    );
  }

  console.log(
    "\nDernier férié:",
    last ? `${last.date} → ${last.pharmacie} (idx ${last.idx})` : "(non trouvé)"
  );
  console.log(
    "Suivant attendu 2028:",
    last
      ? `${PHARMACIES_CENTRE[(last.idx + 1) % 8].name} (idx ${(last.idx + 1) % 8})`
      : "?"
  );

  console.log("\n=== 3. inferEndStateFromPlanningDays(2027) ===");
  console.log(end2027);
  console.log(
    "configFromYearConfig → ferieStartIdx:",
    configFromYearConfig(end2027).ferieStartIdx,
    "=",
    PHARMACIES_CENTRE[configFromYearConfig(end2027).ferieStartIdx].name
  );

  if (yc2027) {
    console.log(
      "\nconfigFromYearConfig(YearConfig) → ferieStartIdx:",
      configFromYearConfig(yc2027).ferieStartIdx,
      "=",
      PHARMACIES_CENTRE[configFromYearConfig(yc2027).ferieStartIdx].name
    );
  }

  console.log("\n=== 4. resolveRotationConfigForYear(2028) ===");
  console.log(cfg2028);
  console.log("Rotation Fériés 2028 début:", rot2028.ferie[0]?.name);
  console.log("Rotation Dimanches 2028 début:", rot2028.domingo[0]?.name);

  console.log("\n=== 5. Rotation Fériés 2027 (liste complète) ===");
  console.log(rot2027.ferie.map((r) => r.name.replace("Pharmacie ", "")).join(" → "));

  const lastSat2027 = [...days2027]
    .filter((d) => d.date.getFullYear() === 2027 && d.date.getDay() === 6 && d.pharmacie)
    .at(-1);
  console.log("\n=== 6. Dernier samedi 2027 ===");
  console.log(
    lastSat2027
      ? `${formatDateFR(lastSat2027.date)} → ${lastSat2027.pharmacie} (idx ${idxOf(lastSat2027.pharmacie)})`
      : "(non trouvé)"
  );
  console.log(
    "Dimanche suivant attendu:",
    lastSat2027
      ? PHARMACIES_CENTRE[(idxOf(lastSat2027.pharmacie) + 1) % 8].name
      : "?"
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
