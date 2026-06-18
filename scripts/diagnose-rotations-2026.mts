import { prisma } from "../src/lib/db";
import { enrichVideDaysFromWeekend } from "../src/lib/excel";
import {
  buildRotationsFromConfig,
  resolveRotationConfigForYear,
} from "../src/lib/rotations";
import { configFromYearConfig, getFeriesDates } from "../src/lib/generatePlanning";
import {
  inferEndStateFromPlanningDays,
  findFerieRotationForDate,
} from "../src/lib/planningRotationState";
import { PHARMACIES_CENTRE } from "../src/lib/pharmacies";
import { formatDateFR } from "../src/lib/dates";

async function loadDays(year: number) {
  const raw = await prisma.planningDay.findMany({
    where: { year },
    orderBy: { date: "asc" },
  });
  return enrichVideDaysFromWeekend(raw).map((d) => ({
    ...d,
    type: d.type as import("../src/lib/types").PlanningDayInput["type"],
  }));
}

async function main() {
  const yc2026 = await prisma.yearConfig.findUnique({ where: { year: 2026 } });
  console.log("=== 1. YearConfig 2026 en base ===");
  console.log(JSON.stringify(yc2026, null, 2));

  const days2026 = await loadDays(2026);
  const end2026 = inferEndStateFromPlanningDays(days2026, 2026);
  console.log("\n=== 2. État fin inféré depuis planning 2026 (NOUVELLE logique) ===");
  console.log(end2026);

  console.log("\n=== 3. Dernières gardes par type (planning DB) ===");
  const lastSat = [...days2026]
    .reverse()
    .find((d) => d.date.getDay() === 6 && d.type === "weekend" && d.pharmacie);
  const lastLundi = [...days2026]
    .reverse()
    .find((d) => d.type === "lundi" && d.pharmacie);

  const noel2026 = getFeriesDates(2026).find((f) => f.getMonth() === 11 && f.getDate() === 25);
  const noelGuard = noel2026
    ? findFerieRotationForDate(days2026, noel2026)
    : null;

  console.log(
    "Noël 25/12 fériés:",
    noelGuard
      ? `${formatDateFR(noelGuard.date)} → ${noelGuard.pharmacie.replace("Pharmacie ", "")}`
      : "(non trouvé)"
  );
  console.log(
    "Dernier samedi week-end:",
    lastSat
      ? `${formatDateFR(lastSat.date)} → ${lastSat.pharmacie.replace("Pharmacie ", "")}`
      : "(non trouvé)"
  );
  console.log(
    "Dernier lundi:",
    lastLundi
      ? `${formatDateFR(lastLundi.date)} → ${lastLundi.pharmacie.replace("Pharmacie ", "")}`
      : "(non trouvé)"
  );

  console.log("\n=== Attendu (Excel Norman) ===");
  console.log("Fériés fin: Parc Olympique (idx 2)");
  console.log("Dimanches fin: Pierre du Roy (idx 6) — samedi 26/12");
  console.log("Lundis fin: Lauzière");

  console.log("\n=== 4. Rotations 2026 (affichage année) ===");
  const cfg26 = await resolveRotationConfigForYear(2026);
  const rot26 = buildRotationsFromConfig(2026, cfg26);
  console.log("Config début 2026:", cfg26);
  console.log("Fériés fin liste:", rot26.ferie.at(-1)?.name);
  console.log("Dimanches fin liste:", rot26.domingo.at(-1)?.name);
  console.log("Lundis fin liste:", rot26.lundi.at(-1)?.name);

  console.log("\n=== 5. Rotations 2027 (continuité depuis 2026) ===");
  const cfg27 = await resolveRotationConfigForYear(2027);
  const rot27 = buildRotationsFromConfig(2027, cfg27);
  console.log("Config début 2027:", cfg27);
  console.log("Fériés début:", rot27.ferie[0]?.name, `(attendu: ${PHARMACIES_CENTRE[3].name})`);
  console.log("Dimanches début:", rot27.domingo[0]?.name, `(attendu: ${PHARMACIES_CENTRE[7].name})`);
  console.log("Lundis début:", rot27.lundi[0]?.name, "(attendu: Grand Arc)");

  if (yc2026) {
    console.log("\n=== Ancienne méthode (YearConfig) pour 2027 ===");
    console.log(configFromYearConfig(yc2026));
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
