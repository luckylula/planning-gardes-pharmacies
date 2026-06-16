import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generatePlanning } from "@/lib/generatePlanning";
import { getPharmacyByIdx, PHARMACIES_MAURIENNE } from "@/lib/pharmacies";
import type { GenerateConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { year: string } }
) {
  const year = parseInt(params.year, 10);
  const days = await prisma.planningDay.findMany({
    where: { year },
    orderBy: { date: "asc" },
  });
  const config = await prisma.yearConfig.findUnique({ where: { year } });
  return NextResponse.json({ days, config });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { year: string } }
) {
  const year = parseInt(params.year, 10);
  const body = await req.json();

  const config: GenerateConfig = {
    ferieStartIdx: body.ferieStartIdx ?? 0,
    domingoStartIdx: body.domingoStartIdx ?? 0,
    lundiNext: body.lundiNext ?? "lauziere",
    semaineStartIdx: body.semaineStartIdx ?? 0,
  };

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
  await prisma.planningDay.deleteMany({ where: { year } });
  const existing = await prisma.yearConfig.findUnique({ where: { year } });
  if (existing) {
    await prisma.yearConfig.update({
      where: { year },
      data: { generated: false },
    });
  }
  return NextResponse.json({ success: true });
}
