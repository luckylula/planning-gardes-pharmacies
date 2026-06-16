import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { configFromYearConfig } from "@/lib/generatePlanning";
import { getPharmacyByIdx, PHARMACIES_MAURIENNE } from "@/lib/pharmacies";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const yearParam = req.nextUrl.searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear() + 1;

  const prevConfig = await prisma.yearConfig.findFirst({
    where: { year: { lt: year }, generated: true },
    orderBy: { year: "desc" },
  });

  if (!prevConfig) {
    const centreStartIdx = year === 2027 ? 3 : 0;
    const lundiNext = year === 2027 ? ("grand_arc" as const) : ("lauziere" as const);
    return NextResponse.json({
      year,
      hasPrevious: false,
      defaults: {
        centreStartIdx,
        ferieStartIdx: centreStartIdx,
        domingoStartIdx: centreStartIdx,
        lundiNext,
        semaineStartIdx: 0,
      },
      labels: {
        centreNext: getPharmacyByIdx("centre", centreStartIdx).name,
        lundiNext:
          lundiNext === "lauziere"
            ? PHARMACIES_MAURIENNE[0].name
            : PHARMACIES_MAURIENNE[1].name,
        semaineNext: getPharmacyByIdx("exterieures", 0).name,
      },
    });
  }

  const config = configFromYearConfig(prevConfig);
  return NextResponse.json({
    year,
    hasPrevious: true,
    previousYear: prevConfig.year,
    defaults: config,
    labels: {
      centreNext: getPharmacyByIdx("centre", config.centreStartIdx).name,
      lundiNext:
        config.lundiNext === "lauziere"
          ? PHARMACIES_MAURIENNE[0].name
          : PHARMACIES_MAURIENNE[1].name,
      semaineNext: getPharmacyByIdx("exterieures", config.semaineStartIdx).name,
    },
  });
}
