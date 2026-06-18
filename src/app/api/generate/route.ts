import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { configFromYearConfig } from "@/lib/generatePlanning";
import { enrichVideDaysFromWeekend } from "@/lib/excel";
import {
  configForYearFromPreviousPlanning,
  defaultRotationConfig,
} from "@/lib/planningRotationState";
import { getPharmacyByIdx, getExterieuresCycleSlot, PHARMACIES_MAURIENNE } from "@/lib/pharmacies";
import type { PlanningDayInput } from "@/lib/types";

export const dynamic = "force-dynamic";

async function defaultsForYear(year: number) {
  const prevYear = year - 1;
  const prevDays = await prisma.planningDay.findMany({
    where: { year: prevYear },
    orderBy: { date: "asc" },
  });

  if (prevDays.length > 0) {
    const days = enrichVideDaysFromWeekend(prevDays).map((d) => ({
      ...d,
      type: d.type as PlanningDayInput["type"],
    }));
    return {
      hasPrevious: true,
      previousYear: prevYear,
      defaults: configForYearFromPreviousPlanning(days, prevYear),
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
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear() + 1;

  const { hasPrevious, previousYear, defaults } = await defaultsForYear(year);

  if (!hasPrevious) {
    return NextResponse.json({
      year,
      hasPrevious: false,
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
    defaults,
    labels: {
      centreNext: getPharmacyByIdx("centre", defaults.centreStartIdx).name,
      lundiNext:
        defaults.lundiNext === "lauziere"
          ? PHARMACIES_MAURIENNE[0].name
          : PHARMACIES_MAURIENNE[1].name,
      semaineNext: getExterieuresCycleSlot(defaults.semaineStartIdx).pharma.name,
    },
  });
}
