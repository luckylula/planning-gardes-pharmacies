import { prisma } from "../src/lib/db";
import { enrichVideDaysFromWeekend } from "../src/lib/excel";
import {
  buildRotationsFromConfig,
  resolveRotationConfigForYear,
  resolveStartConfigFromPreviousYear,
  getBaselineRotations,
} from "../src/lib/rotations";
import { configFromYearConfig } from "../src/lib/generatePlanning";
import { inferEndStateFromPlanningDays } from "../src/lib/planningRotationState";
import { PHARMACIES_CENTRE } from "../src/lib/pharmacies";
import { formatDateFR } from "../src/lib/dates";

function idxOf(name: string) {
  return PHARMACIES_CENTRE.findIndex((p) => p.name === name);
}

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

async function main() {
  const yc2028 = await prisma.yearConfig.findUnique({ where: { year: 2028 } });
  const days2028 = await loadDays(2028);
  const inferred = inferEndStateFromPlanningDays(days2028, 2028);
  const fromYc = yc2028 ? configFromYearConfig(yc2028) : null;
  const fromResolve = await resolveStartConfigFromPreviousYear(2028);
  const rot2028 = await resolveRotationConfigForYear(2028);
  const rot2029 = await resolveRotationConfigForYear(2029);
  const built2029 = buildRotationsFromConfig(2029, rot2029);

  console.log("=== 1. YearConfig 2028 ===");
  console.log(
    yc2028
      ? {
          last_ferie_pharma: yc2028.last_ferie_pharma,
          last_ferie_idx: yc2028.last_ferie_idx,
          last_domingo_pharma: yc2028.last_domingo_pharma,
          last_domingo_idx: yc2028.last_domingo_idx,
          generated: yc2028.generated,
        }
      : "(absent)"
  );

  console.log("\n=== 2. inferEndStateFromPlanningDays(2028) ===");
  console.log({
    last_ferie_pharma: inferred.last_ferie_pharma,
    last_ferie_idx: inferred.last_ferie_idx,
  });
  console.log(
    "→ ferieStartIdx 2029 (infer):",
    configFromYearConfig(inferred).ferieStartIdx,
    "=",
    PHARMACIES_CENTRE[configFromYearConfig(inferred).ferieStartIdx].name
  );

  if (fromYc) {
    console.log("\n=== 3. configFromYearConfig(YearConfig 2028) ===");
    console.log({
      ferieStartIdx: fromYc.ferieStartIdx,
      ferieStart: PHARMACIES_CENTRE[fromYc.ferieStartIdx].name,
    });
  }

  console.log("\n=== 4. resolveStartConfigFromPreviousYear(2028) [usado para 2029] ===");
  console.log({
    ferieStartIdx: fromResolve.ferieStartIdx,
    ferieStart: PHARMACIES_CENTRE[fromResolve.ferieStartIdx].name,
  });

  console.log("\n=== 5. Rotation Fériés 2028 (inicio) ===");
  const built2028 = buildRotationsFromConfig(2028, rot2028);
  console.log(
    built2028.ferie.map((r) => r.name.replace("Pharmacie ", "")).join(" → ")
  );

  console.log("\n=== 6. Rotation Fériés 2029 (inicio) ===");
  console.log("Primer ferie:", built2029.ferie[0]?.name);
  console.log(
    "Lista:",
    built2029.ferie.map((r) => r.name.replace("Pharmacie ", "")).join(" → ")
  );
  console.log(
    "Esperado inicio 2029: Croix de l'Orme (idx 6)"
  );

  console.log("\n=== 7. Filas type=ferie 19h15 en planning 2028 (dic) ===");
  const ferieRows = days2028.filter(
    (d) =>
      d.type === "ferie" &&
      d.heure_debut !== "09h00" &&
      d.date.getFullYear() === 2028 &&
      d.date.getMonth() >= 10
  );
  for (const d of ferieRows) {
    console.log(
      `  ${formatDateFR(d.date)} ${d.heure_debut} → ${d.pharmacie} (idx ${idxOf(d.pharmacie)})`
    );
  }

  const dec31 = days2028.find(
    (d) =>
      d.date.getFullYear() === 2028 &&
      d.date.getMonth() === 11 &&
      d.date.getDate() === 31
  );
  console.log("\n=== 8. Fila 31/12/2028 (cualquier tipo) ===");
  console.log(
    dec31
      ? {
          type: dec31.type,
          heure_debut: dec31.heure_debut,
          pharmacie: dec31.pharmacie,
          idx: idxOf(dec31.pharmacie),
        }
      : "(no existe)"
  );

  console.log("\n=== 9. Última isFerieRotation (type=ferie, 19h15) en 2028 ===");
  let lastFerie: (typeof days2028)[0] | null = null;
  for (const d of days2028) {
    if (
      d.date.getFullYear() === 2028 &&
      d.type === "ferie" &&
      d.heure_debut !== "09h00" &&
      d.pharmacie &&
      idxOf(d.pharmacie) >= 0
    ) {
      lastFerie = d;
    }
  }
  console.log(
    lastFerie
      ? `${formatDateFR(lastFerie.date)} → ${lastFerie.pharmacie} (idx ${idxOf(lastFerie.pharmacie)})`
      : "(ninguna)"
  );

  console.log("\n=== 10. ¿Coinciden YearConfig vs inferencia? ===");
  if (yc2028) {
    const match =
      yc2028.last_ferie_idx === inferred.last_ferie_idx &&
      yc2028.last_ferie_pharma === inferred.last_ferie_pharma;
    console.log(match ? "✅ Coinciden" : "❌ DIFIEREN");
    if (!match) {
      console.log("  YearConfig:", yc2028.last_ferie_idx, yc2028.last_ferie_pharma);
      console.log("  Inferido:", inferred.last_ferie_idx, inferred.last_ferie_pharma);
      console.log(
        "  resolveStartConfigFromPreviousYear usa:",
        fromResolve.ferieStartIdx === fromYc?.ferieStartIdx
          ? "YearConfig (prioridad)"
          : "otro"
      );
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
