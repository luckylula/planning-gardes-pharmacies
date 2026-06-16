import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { planningDaysToExcel } from "@/lib/excel";

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

  const buffer = planningDaysToExcel(
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
    year
  );

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Planning_${year}.xlsx"`,
    },
  });
}
