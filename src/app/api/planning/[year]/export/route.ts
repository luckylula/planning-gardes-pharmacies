import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { enrichVideDaysFromWeekend, planningDaysToExcel } from "@/lib/excel";
import { getYearRotations } from "@/lib/rotations";

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
  const rotations = await getYearRotations(year);

  const buffer = await planningDaysToExcel(
    days.map((d) => ({
      year: d.year,
      date: d.date,
      heure_debut: d.heure_debut,
      date_fin: d.date_fin,
      heure_fin: d.heure_fin,
      pharmacie: d.pharmacie,
      adresse: d.adresse,
      type: d.type as "ferie" | "weekend" | "lundi" | "semaine" | "vide",
    })),
    year,
    rotations
  );

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Planning_${year}.xlsx"`,
    },
  });
}
