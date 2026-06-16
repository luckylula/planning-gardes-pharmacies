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
    return NextResponse.json({
      year,
      hasPrevious: false,
      defaults: {
        ferieStartIdx: 0,
        domingoStartIdx: 0,
        lundiNext: "lauziere" as const,
        semaineStartIdx: 0,
      },
      labels: {
        ferieNext: getPharmacyByIdx("centre", 0).name,
        domingoNext: getPharmacyByIdx("centre", 0).name,
        lundiNext: PHARMACIES_MAURIENNE[0].name,
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
      ferieNext: getPharmacyByIdx("centre", config.ferieStartIdx).name,
      domingoNext: getPharmacyByIdx("centre", config.domingoStartIdx).name,
      lundiNext:
        config.lundiNext === "lauziere"
          ? PHARMACIES_MAURIENNE[0].name
          : PHARMACIES_MAURIENNE[1].name,
      semaineNext: getPharmacyByIdx("exterieures", config.semaineStartIdx).name,
    },
  });
}
