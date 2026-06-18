import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import {
  analyzeImport,
  parseExcelBuffer,
  rowsToPlanningDays,
} from "../src/lib/excel";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: npx tsx scripts/run-import.mts <excel-file>");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const buffer = readFileSync(filePath);
  const rows = parseExcelBuffer(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  );
  const summary = analyzeImport(rows);
  const year = summary.year;
  const days = rowsToPlanningDays(rows, year);

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
      create: {
        year,
        last_ferie_pharma: summary.lastFeriePharma,
        last_ferie_idx: summary.lastFerieIdx,
        last_domingo_pharma: summary.lastDomingoPharma,
        last_domingo_idx: summary.lastDomingoIdx,
        last_lundi_pharma: summary.lastLundiPharma,
        last_semaine_idx: summary.lastSemaineIdx,
        generated: true,
      },
      update: {
        last_ferie_pharma: summary.lastFeriePharma,
        last_ferie_idx: summary.lastFerieIdx,
        last_domingo_pharma: summary.lastDomingoPharma,
        last_domingo_idx: summary.lastDomingoIdx,
        last_lundi_pharma: summary.lastLundiPharma,
        last_semaine_idx: summary.lastSemaineIdx,
        generated: true,
      },
    }),
  ]);

  const config = await prisma.yearConfig.findUnique({ where: { year } });
  console.log("Import OK:", { year, days: days.length, yearConfig: config });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
