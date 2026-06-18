import { prisma } from "../src/lib/db";

async function main() {
  for (const year of [2026, 2027]) {
    const rows = await prisma.planningDay.findMany({
      where: {
        year,
        date: {
          gte: new Date(`${year}-12-28T12:00:00`),
        },
      },
      orderBy: { date: "asc" },
    });
    console.log(`\n=== ${year} late December ===`);
    for (const r of rows) {
      const d = r.date.toISOString().slice(0, 10);
      console.log(`${d} ${r.heure_debut} ${r.type} ${r.pharmacie?.replace("Pharmacie ", "")}`);
    }
  }
  const yc2026 = await prisma.yearConfig.findUnique({ where: { year: 2026 } });
  console.log("\n2026 generated?", yc2026?.generated);
  await prisma.$disconnect();
}
main();
