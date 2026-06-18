import { getFirstMondayOfJanuary, addDays, dateKey } from "../src/lib/dates";
import { getFeriesDates, collectRelevantFerieDates } from "../src/lib/generatePlanning";

const PLANNING_DAYS = 364;

function analyzeWindow(year: number) {
  const start = getFirstMondayOfJanuary(year);
  const end = addDays(start, PLANNING_DAYS - 1);
  const ny = getFeriesDates(year + 1)[0];
  const relevant = collectRelevantFerieDates(start, end);
  const nyOk = relevant.some((d) => dateKey(d) === dateKey(ny));
  const endBeforeDec31 = dateKey(end) < `${year}-12-31`;
  return { year, end: dateKey(end), nyOk, endBeforeDec31, jan1IsMonday: start.getMonth() === 0 && start.getDate() === 1 };
}

const fails: number[] = [];
for (let y = 2026; y <= 2050; y++) {
  const a = analyzeWindow(y);
  if (!a.nyOk) {
    fails.push(y);
    console.log(`❌ ${y}: fin=${a.end} jan1Lundi=${a.jan1IsMonday}`);
  }
}
console.log(`\nTotal échecs 2026-2050: ${fails.length}`);
console.log("Années:", fails.join(", "));
