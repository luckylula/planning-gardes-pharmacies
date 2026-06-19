import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { configFromYearConfig } from "@/lib/generatePlanning";
import { defaultRotationConfig } from "@/lib/planningRotationState";
import { resolveStartConfigFromPreviousYear } from "@/lib/rotations";
import {
  getPharmacyByIdx,
  getExterieuresCycleSlot,
  PHARMACIES_MAURIENNE,
} from "@/lib/pharmacies";

export const dynamic = "force-dynamic";

async function defaultsForYear(year: number) {
  const prevYear = year - 1;
  const prevDays = await prisma.planningDay.findMany({
    where: { year: prevYear },
    orderBy: { date: "asc" },
  });

  if (prevDays.length > 0) {
    return {
      hasPrevious: true,
      previousYear: prevYear,
      defaults: await resolveStartConfigFromPreviousYear(prevYear),
    };
  }

  const prevConfig = await prisma.yearConfig.findFirst({
    where: { year: { lt: year }, generated: true },
    orderBy: { year: "desc" },
  });

  if (prevConfig) {
    return {
      hasPrevious: true,
      previousYear: prevConfig.year,
      defaults: configFromYearConfig(prevConfig),
    };
  }

  return {
    hasPrevious: false,
    previousYear: null as number | null,
    defaults: defaultRotationConfig(year),
  };
}

export async function GET(req: NextRequest) {
  const yearParam = req.nextUrl.searchParams.get("year");
  const year = yearParam
    ? parseInt(yearParam, 10)
    : new Date().getFullYear() + 1;

  const existing = await prisma.yearConfig.findUnique({
    where: { year },
    select: { generated: true },
  });
  const dayCount = await prisma.planningDay.count({ where: { year } });
  const alreadyGenerated = (existing?.generated ?? false) || dayCount > 0;

  const { hasPrevious, previousYear, defaults } = await defaultsForYear(year);

  if (!hasPrevious) {
    return NextResponse.json({
      year,
      hasPrevious: false,
      alreadyGenerated,
      defaults,
      labels: {
        centreNext: getPharmacyByIdx("centre", defaults.centreStartIdx).name,
        lundiNext:
          defaults.lundiNext === "lauziere"
            ? PHARMACIES_MAURIENNE[0].name
            : PHARMACIES_MAURIENNE[1].name,
        semaineNext: getExterieuresCycleSlot(defaults.semaineStartIdx).pharma
          .name,
      },
    });
  }

  return NextResponse.json({
    year,
    hasPrevious: true,
    previousYear,
    alreadyGenerated,
    defaults,
    labels: {
      centreNext: getPharmacyByIdx("centre", defaults.centreStartIdx).name,
      lundiNext:
        defaults.lundiNext === "lauziere"
          ? PHARMACIES_MAURIENNE[0].name
          : PHARMACIES_MAURIENNE[1].name,
      semaineNext: getExterieuresCycleSlot(defaults.semaineStartIdx).pharma
        .name,
    },
  });
}
