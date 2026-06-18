import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { generatePlanning, normalizeGenerateConfig } from "@/lib/generatePlanning";
import { getPharmacyByIdx, PHARMACIES_MAURIENNE } from "@/lib/pharmacies";

import { computeStatsFromDb, enrichVideDaysFromWeekend } from "@/lib/excel";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { year: string } }
) {
  const year = parseInt(params.year, 10);
  const rawDays = await prisma.planningDay.findMany({
    where: { year },
    orderBy: { date: "asc" },
  });

  const days = enrichVideDaysFromWeekend(rawDays);
  const config = await prisma.yearConfig.findUnique({ where: { year } });
  const stats = await computeStatsFromDb(year);
  return NextResponse.json({ days, config, stats });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { year: string } }
) {
  const year = parseInt(params.year, 10);
  const body = await req.json();

  const config = normalizeGenerateConfig({
    centreStartIdx: body.centreStartIdx,
    ferieStartIdx: body.ferieStartIdx,
    domingoStartIdx: body.domingoStartIdx,
    lundiNext: body.lundiNext,
    semaineStartIdx: body.semaineStartIdx,
  });

  const { days, finalState } = generatePlanning(year, config);

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
        ...finalState,
        generated: true,
      },
      update: {
        ...finalState,
        generated: true,
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    count: days.length,
    finalState,
    nextYear: {
      ferieNext: getPharmacyByIdx("centre", (finalState.last_ferie_idx + 1) % 8),
      domingoNext: getPharmacyByIdx("centre", (finalState.last_domingo_idx + 1) % 8),
      lundiNext:
        finalState.last_lundi_pharma.includes("Lauzière") ||
        finalState.last_lundi_pharma.includes("Lauziere")
          ? PHARMACIES_MAURIENNE[1]
          : PHARMACIES_MAURIENNE[0],
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { year: string } }
) {
  const year = parseInt(params.year, 10);

  await prisma.$transaction([
    prisma.planningDay.deleteMany({ where: { year } }),
    prisma.yearConfig.updateMany({
      where: { year },
      data: { generated: false },
    }),
  ]);

  revalidatePath("/");
  revalidatePath(`/planning/${year}`);

  return NextResponse.json({ success: true });
}
