import { PrismaClient } from "@prisma/client";
import {
  configFromYearConfig,
  generatePlanning,
  normalizeGenerateConfig,
} from "../src/lib/generatePlanning";

const prisma = new PrismaClient();

async function main() {
  for (const year of [2026, 2027]) {
    await prisma.planningDay.deleteMany({ where: { year } });
    await prisma.yearConfig.deleteMany({ where: { year } });
    console.log(`Reset ${year}`);
  }

  const cfg2026 = normalizeGenerateConfig({
    centreStartIdx: 0,
    lundiNext: "grand_arc",
    semaineStartIdx: 0,
  });

  const { days: d2026, finalState: s2026 } = generatePlanning(2026, cfg2026);
  await prisma.planningDay.createMany({
    data: d2026.map((d) => ({
      year: d.year,
      date: d.date,
      heure_debut: d.heure_debut,
      date_fin: d.date_fin,
      heure_fin: d.heure_fin,
      pharmacie: d.pharmacie,
      adresse: d.adresse,
      type: d.type,
    })),
  });
  await prisma.yearConfig.create({
    data: { year: 2026, ...s2026, generated: true },
  });
  console.log(`Generated 2026: ${d2026.length} days, last centre idx ${s2026.last_domingo_idx}`);

  const cfg2027 = configFromYearConfig(s2026);
  const { days: d2027, finalState: s2027 } = generatePlanning(2027, cfg2027);
  await prisma.planningDay.createMany({
    data: d2027.map((d) => ({
      year: d.year,
      date: d.date,
      heure_debut: d.heure_debut,
      date_fin: d.date_fin,
      heure_fin: d.heure_fin,
      pharmacie: d.pharmacie,
      adresse: d.adresse,
      type: d.type,
    })),
  });
  await prisma.yearConfig.create({
    data: { year: 2027, ...s2027, generated: true },
  });
  console.log(`Generated 2027: ${d2027.length} days, centre start was idx ${cfg2027.centreStartIdx}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
