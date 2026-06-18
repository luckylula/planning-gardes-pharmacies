import {
  generatePlanning,
  collectRelevantFerieDates,
  getFeriesDates,
} from "../src/lib/generatePlanning";
import {
  resolveRotationConfigForYear,
  buildRotationsFromConfig,
} from "../src/lib/rotations";
import {
  getFirstMondayOfJanuary,
  addDays,
  dateKey,
} from "../src/lib/dates";

const PLANNING_DAYS = 364;

const DOW = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];

function nyGuardDebut(nyDate: Date): Date {
  const dow = nyDate.getDay();
  if (dow === 1) return addDays(nyDate, -1); // lundi → garde depuis 31/12
  if (dow >= 2 && dow <= 5) return addDays(nyDate, -1);
  if (dow === 6) return addDays(nyDate, -1); // samedi → 1ère garde depuis vendredi
  return addDays(nyDate, -2); // dimanche → depuis samedi
}

function simulateYear(year: number, config: Awaited<ReturnType<typeof resolveRotationConfigForYear>>) {
  const start = getFirstMondayOfJanuary(year);
  const end = addDays(start, PLANNING_DAYS - 1);
  const ny = getFeriesDates(year + 1)[0];
  const bridgeDebut = nyGuardDebut(ny);
  const relevant = collectRelevantFerieDates(start, end);
  const nyRelevant = relevant.some((d) => dateKey(d) === dateKey(ny));

  const { days, finalState } = generatePlanning(year, config);
  const lastDay = days[days.length - 1];
  const bridgeRow = days.find(
    (d) =>
      d.type === "ferie" &&
      d.heure_debut !== "09h00" &&
      dateKey(d.date) === dateKey(bridgeDebut)
  );
  const dec31Row = days.find((d) => dateKey(d.date) === `${year}-12-31`);

  const bridgeNeeded = bridgeDebut >= start && bridgeDebut <= end;
  const bridgeOk = !bridgeNeeded || !!bridgeRow;

  return {
    year,
    jan1Dow: DOW[ny.getDay()],
    windowStart: dateKey(start),
    windowEnd: dateKey(end),
    lastPlanningDay: dateKey(lastDay.date),
    nyNext: dateKey(ny),
    bridgeDebut: dateKey(bridgeDebut),
    bridgeNeeded,
    nyInRelevant: nyRelevant,
    dec31: dec31Row
      ? { type: dec31Row.type, pharmacie: dec31Row.pharmacie }
      : null,
    bridgeFerie: bridgeRow
      ? { date: dateKey(bridgeRow.date), pharmacie: bridgeRow.pharmacie }
      : null,
    bridgeOk,
    lastFerieIdx: finalState.last_ferie_idx,
    lastFeriePharma: finalState.last_ferie_pharma,
  };
}

async function chainFrom(year: number) {
  const config = await resolveRotationConfigFromDbOrChain(year);
  return simulateYear(year, config);
}

async function resolveRotationConfigFromDbOrChain(year: number) {
  return resolveRotationConfigForYear(year);
}

async function main() {
  console.log("=== Analyse générique collectRelevantFerieDates (2028-2035) ===\n");
  console.log(
    "bridgeNeeded = date début garde Jour de l'An Y+1 ∈ [start, end]\n"
  );

  const years = [2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035];
  const results = [];
  for (const y of years) {
    results.push(await chainFrom(y));
  }

  for (const r of results) {
    const status = r.bridgeOk ? "✅" : "❌";
    console.log(
      `${status} ${r.year}: fenêtre ${r.windowStart}→${r.windowEnd} | ` +
        `01/01/${r.year + 1} (${r.jan1Dow}) garde dès ${r.bridgeDebut} | ` +
        `relevant=${r.nyInRelevant} bridge=${r.bridgeFerie ? r.bridgeFerie.pharmacie.replace("Pharmacie ", "") : "ABSENT"} | ` +
        `last=${r.lastFeriePharma.replace("Pharmacie ", "")}`
    );
  }

  const failures = results.filter((r) => !r.bridgeOk);
  console.log(
    `\nÉchecs pont fin d'année: ${failures.length}/${results.length}`
  );
  if (failures.length) {
    console.log(
      "Années concernées:",
      failures.map((f) => f.year).join(", ")
    );
    console.log(
      "Cause: date début garde",
      failures.map((f) => `${f.year}→${f.year + 1} (${f.bridgeDebut} > fin ${f.windowEnd})`).join("; ")
    );
  }

  console.log("\n=== Focus 2030 et 2031 (simulation depuis DB) ===\n");
  for (const y of [2030, 2031]) {
    const r = await chainFrom(y);
    const nextStart = buildRotationsFromConfig(
      y + 1,
      {
        centreStartIdx: (r.lastFerieIdx + 1) % 8,
        ferieStartIdx: (r.lastFerieIdx + 1) % 8,
        domingoStartIdx: 0,
        lundiNext: "lauziere",
        semaineStartIdx: 0,
      }
    );
    console.log(`--- ${y} ---`);
    console.log(`  Fenêtre: ${r.windowStart} → ${r.windowEnd} (dernier jour planning: ${r.lastPlanningDay})`);
    console.log(`  Jour de l'An ${y + 1}: ${r.nyNext} (${r.jan1Dow})`);
    console.log(`  Garde pont devrait commencer: ${r.bridgeDebut}`);
    console.log(`  collectRelevantFerieDates inclut NY: ${r.nyInRelevant}`);
    console.log(`  Garde pont générée:`, r.bridgeFerie ?? "NON");
    console.log(`  31/12/${y} dans planning:`, r.dec31 ?? "pas de ligne");
    console.log(`  last_ferie: idx ${r.lastFerieIdx} ${r.lastFeriePharma}`);
    console.log(`  → début Fériés ${y + 1} serait: ${nextStart.ferie[0]?.name}`);
    console.log(`  Pont OK: ${r.bridgeOk ? "OUI" : "NON"}\n`);
  }

  // 2030 specifically from corrected 2029 YearConfig
  console.log("=== 2030 chaîné depuis YearConfig 2029 (DB) ===");
  const cfg2030 = await resolveRotationConfigForYear(2030);
  const r2030 = simulateYear(2030, cfg2030);
  const rot2031 = buildRotationsFromConfig(2031, {
    ...cfg2030,
    ferieStartIdx: (r2030.lastFerieIdx + 1) % 8,
    centreStartIdx: (r2030.lastFerieIdx + 1) % 8,
    domingoStartIdx: (r2030.lastFerieIdx + 1) % 8,
  });
  console.log("2030 bridge:", r2030.bridgeFerie ?? "ABSENT");
  console.log("2030 last_ferie:", r2030.lastFeriePharma);
  console.log("2031 ferie start (if 2030 correct):", rot2031.ferie[0]?.name);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
