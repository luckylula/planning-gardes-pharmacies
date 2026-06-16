import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { analyzeImport, parseExcelBuffer, rowsToPlanningDays } from "@/lib/excel";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const confirm = formData.get("confirm") === "true";
  const targetYear = formData.get("year")
    ? parseInt(String(formData.get("year")), 10)
    : null;

  if (!file) {
    return NextResponse.json({ error: "Fichier requis" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const rows = parseExcelBuffer(buffer);
  const summary = analyzeImport(rows);
  const year = targetYear ?? summary.year;

  if (!confirm) {
    return NextResponse.json({ summary, preview: rows.slice(0, 5) });
  }

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

  return NextResponse.json({ success: true, year, count: days.length, summary });
}
