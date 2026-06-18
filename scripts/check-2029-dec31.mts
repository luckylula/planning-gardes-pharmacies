import { generatePlanning, collectRelevantFerieDates } from "../src/lib/generatePlanning";
import { resolveRotationConfigForYear } from "../src/lib/rotations";
import { getFirstMondayOfJanuary, addDays, dateKey } from "../src/lib/dates";
import { prisma } from "../src/lib/db";

async function main() {
  const y = 2029;
  const start = getFirstMondayOfJanuary(y);
  const end = addDays(start, 363);
  const cfg = await resolveRotationConfigForYear(y);
  const r = generatePlanning(y, cfg);
  const d31 = r.days.find((d) => dateKey(d.date) === "2029-12-31");
  const db = await prisma.planningDay.findFirst({
    where: { year: 2029, date: new Date("2029-12-31T12:00:00") },
  });
  console.log("2029 window:", dateKey(start), "→", dateKey(end));
  console.log("NY2030 in relevant:", collectRelevantFerieDates(start, end).map(dateKey));
  console.log("sim 31/12:", d31 ? { type: d31.type, p: d31.pharmacie } : null);
  console.log("db 31/12:", db ? { type: db.type, p: db.pharmacie } : null);
  console.log("last ferie:", r.finalState.last_ferie_idx, r.finalState.last_ferie_pharma);
  await prisma.$disconnect();
}
main();
